import { getServerClient } from '@/lib/supabase/server';

export interface UserProfile {
    id: string;
    company_id: number | null;
    full_name: string | null;
}

/** Load a user's profile row from public.profiles by userId (auth.users.id) */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
    const supabase = getServerClient();
    const { data, error } = await supabase
        .from('profiles')
        .select('id, company_id, full_name')
        .eq('id', userId)
        .single();

    if (error || !data) return null;
    return data as UserProfile;
}
