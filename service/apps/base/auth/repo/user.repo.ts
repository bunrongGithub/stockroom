import { getServerClient } from '@/lib/supabase/server';
import type { TAuthUserRole } from '@/service/apps/base/auth/constant';

export interface UserRecord {
    id: string;
    company_id: string;
    role: TAuthUserRole;
    password_hash: string;
    email: string;
}

export async function lookupUser(email: string): Promise<UserRecord | null> {
    const supabase = getServerClient();
    const { data, error } = await supabase
        .from('users')
        .select('id, company_id, role, password_hash, email')
        .eq('email', email)
        .single();

    if (error || !data) return null;
    return data as UserRecord;
}
