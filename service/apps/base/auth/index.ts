import { createAuthClient, getServerClient } from '@/lib/supabase/server';
import { signToken } from '@/lib/auth';
import { ApiError, UnauthorizedError } from '@/service/core/api-response';
import type { LoginInput, SignupInput } from '@/service/schema/auth.schema';

// ── Login ──────────────────────────────────────────────────────────────────
// Uses Supabase Auth email/password sign-in.
// On success, issues a short-lived custom JWT with userId + companyId + role
// so the rest of the app (API routes, middleware) can read session context
// from a simple cookie without calling Supabase on every request.
export async function login(input: LoginInput): Promise<string> {
    const supabase = getServerClient();

    // 1. Verify credentials via Supabase Auth — on a throwaway client, so the
    //    shared service client never inherits this user's session.
    const { data: authData, error: authError } =
        await createAuthClient().auth.signInWithPassword({
            email: input.email,
            password: input.password,
        });

    if (authError || !authData.user) {
        throw new UnauthorizedError('Invalid login credentials');
    }

    const userId = authData.user.id;

    // 2. Load the profile to get company_id
    const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', userId)
        .single();

    const companyId = (profile as { company_id: number } | null)?.company_id ?? null;

    // A user without a company cannot use the app — every query is scoped by
    // company_id. Fail with a clear message instead of signing companyId:''
    // (which turns into NaN downstream and surfaces as an opaque 400).
    if (!companyId) {
        throw new UnauthorizedError(
            'Your account is not linked to a company. Please register a company or contact an administrator.',
        );
    }

    // 3. Resolve the user's primary role (highest priority from user_role)
    const { data: roleRow } = await supabase
        .from('user_role')
        .select('roles(name)')
        .eq('user_id', userId)
        .eq('company_id', companyId)
        .limit(1)
        .single();

    const roleName =
        (roleRow as { roles: { name: string } } | null)?.roles?.name ?? 'member';

    // 4. Track last login (fire-and-forget — login must not fail on this)
    supabase
        .from('profiles')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', userId)
        .then(({ error }) => {
            if (error) console.error('[auth] last_login_at update failed:', error.message);
        });

    // 5. Issue custom JWT
    return signToken({
        userId,
        companyId: String(companyId),
        role: roleName as import('@/service/apps/base/auth/constant').TAuthUserRole,
        email: authData.user.email ?? input.email,
    });
}

// ── Sign Up (company onboarding) ───────────────────────────────────────────
// Register User → Create Company → Create Profile → Create Owner Role →
// Assign Owner Role → Grant Full Permissions → Seed Document Sequences.
//
// The auth user is created via the Supabase admin API (cannot join a Postgres
// transaction); everything else runs atomically inside the `onboard_company`
// RPC. If the RPC fails, we compensate by deleting the auth user so no
// partial onboarding state survives.
export async function signup(
    input: SignupInput,
): Promise<{ userId: string; companyId: number; email: string }> {
    const supabase = getServerClient();

    // 1. Create Supabase Auth user
    const { data, error } = await supabase.auth.admin.createUser({
        email: input.email,
        password: input.password,
        email_confirm: true,
    });

    if (error || !data.user) {
        const message = error?.message ?? 'Signup failed';
        throw new ApiError(
            message.toLowerCase().includes('already')
                ? 'This email is already registered'
                : message,
            message.toLowerCase().includes('already') ? 409 : 500,
            'SIGNUP_FAILED',
        );
    }

    // 2. Atomic onboarding: company + profile + owner role + membership +
    //    permissions + document sequences — all or nothing.
    const { data: companyId, error: rpcError } = await supabase.rpc(
        'onboard_company',
        {
            p_user_id: data.user.id,
            p_email: input.email,
            p_full_name: input.fullName,
            p_company_name: input.companyName,
        },
    );

    if (rpcError || !companyId) {
        // Compensating action: remove the auth user so the email can retry.
        const { error: deleteError } = await supabase.auth.admin.deleteUser(
            data.user.id,
        );
        if (deleteError) {
            console.error(
                '[auth] onboarding rollback failed — orphan auth user',
                data.user.id,
                deleteError.message,
            );
        }

        if (rpcError?.code === '23505') {
            throw new ApiError(
                'This company name is already taken',
                409,
                'COMPANY_NAME_TAKEN',
            );
        }
        throw new ApiError(
            rpcError?.message ?? 'Company onboarding failed',
            500,
            'ONBOARDING_FAILED',
        );
    }

    return {
        userId: data.user.id,
        companyId: Number(companyId),
        email: input.email,
    };
}
