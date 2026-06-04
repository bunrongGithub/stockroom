import { getServerClient } from '@/lib/supabase/server';
import { signToken } from '@/lib/auth';
import { UnauthorizedError } from '@/service/core/api-response';
import type { LoginInput, SignupInput } from '@/service/schema/auth.schema';

// ── Login ──────────────────────────────────────────────────────────────────
// Uses Supabase Auth email/password sign-in.
// On success, issues a short-lived custom JWT with userId + companyId + role
// so the rest of the app (API routes, middleware) can read session context
// from a simple cookie without calling Supabase on every request.
export async function login(input: LoginInput): Promise<string> {
    const supabase = getServerClient();

    // 1. Verify credentials via Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
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

    // 3. Resolve the user's primary role (highest priority from user_role)
    const { data: roleRow } = companyId
        ? await supabase
              .from('user_role')
              .select('roles(name)')
              .eq('user_id', userId)
              .eq('company_id', companyId)
              .limit(1)
              .single()
        : { data: null };

    const roleName =
        (roleRow as { roles: { name: string } } | null)?.roles?.name ?? 'member';

    // 4. Issue custom JWT
    return signToken({
        userId,
        companyId: String(companyId ?? ''),
        role: roleName as import('@/service/apps/base/auth/constant').TAuthUserRole,
        email: authData.user.email ?? input.email,
    });
}

// ── Sign Up ────────────────────────────────────────────────────────────────
// Creates a Supabase Auth user then inserts a profiles row.
// company_id defaults to the first (default) company.
export async function signup(input: SignupInput): Promise<{ requiresConfirmation: boolean }> {
    const supabase = getServerClient();

    // 1. Create Supabase Auth user
    const { data, error } = await supabase.auth.admin.createUser({
        email: input.email,
        password: input.password,
        email_confirm: true,
    });

    if (error || !data.user) throw new Error(error?.message ?? 'Signup failed');

    // 2. Find the default company
    const { data: company } = await supabase
        .from('company')
        .select('id')
        .eq('domain', 'default')
        .single();

    const companyId = (company as { id: number } | null)?.id ?? null;

    // 3. Create profile
    await supabase.from('profiles').insert({
        id: data.user.id,
        company_id: companyId,
        full_name: input.email.split('@')[0],
    });

    // 4. Assign default 'member' role
    if (companyId) {
        const { data: memberRole } = await supabase
            .from('roles')
            .select('id')
            .eq('name', 'member')
            .single();

        if (memberRole) {
            await supabase.from('user_role').insert({
                user_id: data.user.id,
                role_id: (memberRole as { id: number }).id,
                company_id: companyId,
            });
        }
    }

    return { requiresConfirmation: !data.user.email_confirmed_at };
}
