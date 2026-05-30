import bcrypt from 'bcryptjs';
import { lookupUser } from './repo/user.repo';
import { signToken } from '@/lib/auth';
import { UnauthorizedError } from '@/service/core/api-response';
import type { LoginInput, SignupInput } from '@/service/schema/auth.schema';
import { getServerClient } from '@/lib/supabase/server';

// ── Login ─────────────────────────────────────────────────────
// 1. lookupUser(email)         → SELECT from users table
// 2. bcrypt.compare(pw, hash)  → credential verification
// 3. signToken(payload)        → jwt.sign({ userId, companyId, role })
export async function login(input: LoginInput): Promise<string> {
    const userRecord = await lookupUser(input.email);

    if (!userRecord) throw new UnauthorizedError('Invalid login credentials');

    const valid = await bcrypt.compare(input.password, userRecord.password_hash);
    if (!valid) throw new UnauthorizedError('Invalid login credentials');

    return signToken({
        userId: userRecord.id,
        companyId: userRecord.company_id,
        role: userRecord.role,
        email: userRecord.email,
    });
}

// ── Sign Up ───────────────────────────────────────────────────
// Creates a Supabase auth user then inserts a row in the public
// users table with a bcrypt-hashed password for this auth flow.
export async function signup(input: SignupInput): Promise<{ requiresConfirmation: boolean }> {
    const supabase = getServerClient();

    const { data, error } = await supabase.auth.admin.createUser({
        email: input.email,
        password: input.password,
        email_confirm: false,
    });

    if (error) throw new Error(error.message);

    const password_hash = await bcrypt.hash(input.password, 12);

    const { error: insertError } = await supabase.from('users').insert({
        id: data.user.id,
        email: input.email,
        password_hash,
        role: 'user',
    });

    if (insertError) throw new Error(insertError.message);

    return { requiresConfirmation: !data.user.email_confirmed_at };
}
