import { PaginationMixin } from './pagination';
import { getServerClient, createScopedClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { RequestContext } from '@/types/request-context';

export abstract class BaseRepository extends PaginationMixin {
    /**
     * Applies role-based row scope to any Supabase filter builder.
     *   super_admin → no filter  (full access across all companies)
     *   admin       → company_id only
     *   member|user → company_id + user_id  (own records within company)
     */
    protected applyScope<T>(query: T, ctx: RequestContext): T {
        if (ctx.role === 'super_admin') return query;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let q: any = query;
        q = q.eq('company_id', Number(ctx.companyId));
        if (ctx.role === 'member' || ctx.role === 'user') {
            q = q.eq('user_id', ctx.userId);
        }
        return q as T;
    }

    /** Raw service-role client — no automatic scoping. */
    protected get db(): SupabaseClient {
        return getServerClient();
    }

    /** Company-scoped insert client — automatically stamps company_id on every insert row. */
    protected scopedDb(companyId: number) {
        return createScopedClient(companyId);
    }
}
