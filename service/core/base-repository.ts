import { cache } from 'react';
import { PaginationMixin } from './pagination';
import { getServerClient, createScopedClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { RequestContext } from '@/types/request-context';
import { ApiError, ForbiddenError } from './api-response';

// Deduped per request: multiple repositories touched in one render/handler share
// a single `profiles.is_super_user` lookup instead of querying once each.
const fetchSuperUserFlag = cache(async (userId: string): Promise<boolean> => {
    const { data, error } = await getServerClient()
        .from('profiles')
        .select('is_super_user')
        .eq('id', userId)
        .single();

    if (error) throw new ApiError(error.message, 500, error.code);

    return data?.is_super_user === true;
});

export abstract class BaseRepository extends PaginationMixin {
    /**
     * Applies role-based row scope to any Supabase filter builder.
     *   super_admin → no filter  (full access across all companies)
     *   admin       → company_id only
     *   member|user.... → company_id + user_id  (own records within company)
     */
    protected applyFilter<T>(
        query: T,
        ctx: RequestContext,
        bypassScope = false,
    ): T {
        if (bypassScope) return query;
        const { role, companyId, userId } = ctx;
        return ['super_admin', 'super_user'].includes(role ?? '')
            ? query
            : ['admin'].includes(role ?? '')
              ? this.applyCompanyFilter(query, Number(companyId))
              : (() => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    let _query: any = query;
                    _query = _query
                        .eq('company_id', Number(companyId))
                        .eq('user_id', userId);
                    return _query;
                })();
    }

    /** Raw service-role client — no automatic scoping. */
    protected get db(): SupabaseClient {
        return getServerClient();
    }

    /** Company-scoped insert client — automatically stamps company_id on every insert row. */
    protected scopedDb(companyId: number) {
        return createScopedClient(companyId);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    protected applyCompanyFilter(query: any, companyId: number) {
        return query.eq('company_id', companyId);
    }

    protected async isSupperUser(context: RequestContext) {
        const currentUserId = context.userId;

        if (!currentUserId) throw new ForbiddenError('ForbiddenError');

        return fetchSuperUserFlag(currentUserId);
    }
}
