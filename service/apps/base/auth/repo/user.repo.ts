import { getServerClient } from '@/lib/supabase/server';
import { BaseRepository, PaginationParams } from '@/service/core';
import { RequestContext } from '@/types/request-context';

export interface UserProfile {
    id: string;
    company_id: number | null;
    full_name: string | null;
}

/** Load a user's profile row from public.profiles by userId (auth.users.id) */
export async function getUserProfile(
    userId: string,
): Promise<UserProfile | null> {
    const supabase = getServerClient();
    const { data, error } = await supabase
        .from('profiles')
        .select('id, company_id, full_name')
        .eq('id', userId)
        .single();

    if (error || !data) return null;
    return data as UserProfile;
}

export class UserRepository extends BaseRepository {
    protected tableName = 'profiles';
    protected database = this.db;
    protected schema = 'public';

    async findAll(context: RequestContext, params: PaginationParams) {
        const isSuperUser = await this.isSupperUser(context);
        try {
            const baseQuery = this.database
                .from(this.tableName)
                .select(
                    'id,full_name,company_id,created_at,avatar_url,writed_at',
                )
                .order('id', { ascending: false });

            if (isSuperUser) {
                return this.paginate(baseQuery, params);
            }
            const query = this.applyCompanyFilter(
                baseQuery,
                Number(context.companyId),
            );

            return this.paginate(query, params);
        } catch (err) {
            console.error('Error checking super user status:', err);
        }
    }
}
