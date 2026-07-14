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

/**
 * How a repository's rows are scoped to the caller.
 *
 *   'none'         — global table, no tenant columns (e.g. `modules`).
 *   'company'      — company_id only. The default: every member of a company
 *                    sees all of that company's rows.
 *   'user'         — user_id only (personal rows on a table with no company).
 *   'company_user' — company_id + user_id: only the caller's own rows.
 */
export type QueryScope = 'none' | 'company' | 'user' | 'company_user';

/**
 * Declarative query scoping.
 *
 * This layer knows NOTHING about roles. Roles are user-authored data in this
 * system (a company can create any role it likes, in any language), so branching
 * on role names here would silently break the moment someone invents a new one.
 * A repository instead declares WHAT its rows are scoped by; who is allowed to
 * see across companies is a separate capability decided by the caller (see
 * `bypass` below).
 *
 *   class UomRepository extends BaseRepository {
 *       protected readonly scope: QueryScope = 'company';   // everyone in the
 *                                                           // company sees all
 *       async findAll(ctx, params) {
 *           const base = this.db.from(TABLE).select('*', { count: 'exact' });
 *           const query = this.applyScope(base, ctx, await this.scopeOptions(ctx));
 *           return this.paginate(query, params);
 *       }
 *   }
 *
 * Per-call overrides:
 *   await this.scopeOptions(ctx, { scope: 'company_user' })        // tighten
 *   await this.scopeOptions(ctx, { allowSuperBypass: false })      // never leak
 *
 * Cross-company reads are granted ONLY by the `profiles.is_super_user` FLAG —
 * real data, not a role name — resolved inside `scopeOptions`.
 */
export abstract class BaseQueryFilter extends PaginationMixin {
    /** Scope applied when a call doesn't override it. Tenant-safe by default. */
    protected readonly scope: QueryScope = 'company';

    /** Tenant columns — override when a table names them differently. */
    protected readonly companyColumn: string = 'company_id';
    protected readonly userColumn: string = 'user_id';

    /**
     * Whether a super user may read across companies on this repository.
     * Set `false` where rows must NEVER leave their company no matter who asks
     * (e.g. the company user directory).
     */
    protected readonly allowSuperBypass: boolean = true;

    /**
     * The ONE exception to scoping: `profiles.is_super_user`. A data flag, never
     * a role name. Request-cached, so many repos in one request share a lookup.
     */
    protected async isSuperUser(ctx: RequestContext): Promise<boolean> {
        if (!ctx.userId) throw new ForbiddenError('Session has no valid user');
        return fetchSuperUserFlag(ctx.userId);
    }

    /**
     * Resolve the scoping options for this request (async only because the
     * super-user flag is a DB read).
     *
     * It deliberately returns PLAIN OPTIONS, never a query builder: a Supabase
     * builder is a thenable, so an async helper that resolved to one would be
     * adopted by the promise and fire the query. Pair it with `applyScope`:
     *
     *     const query = this.applyScope(base, ctx, await this.scopeOptions(ctx));
     */
    protected async scopeOptions(
        ctx: RequestContext,
        options: { scope?: QueryScope; allowSuperBypass?: boolean } = {},
    ): Promise<{ scope?: QueryScope; bypass: boolean }> {
        const mayBypass = options.allowSuperBypass ?? this.allowSuperBypass;
        const bypass = mayBypass ? await this.isSuperUser(ctx) : false;
        return { scope: options.scope, bypass };
    }

    /** Scope by company. Override to change the column or add conditions. */
    protected filterByCompany<T>(query: T, companyId: number): T {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (query as any).eq(this.companyColumn, companyId) as T;
    }

    /** Scope by owner. Override to change the column or add conditions. */
    protected filterByUser<T>(query: T, userId: string): T {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (query as any).eq(this.userColumn, userId) as T;
    }

    /**
     * Apply this repository's scope to any Supabase filter builder.
     * Throws if the session lacks the ids the scope needs, so a missing company
     * can never silently widen a query.
     */
    protected applyScope<T>(
        query: T,
        ctx: RequestContext,
        options: { scope?: QueryScope; bypass?: boolean } = {},
    ): T {
        if (options.bypass) return query;

        const effective = options.scope ?? this.scope;
        if (effective === 'none') return query;

        const companyId = Number(ctx.companyId);
        const needsCompany =
            effective === 'company' || effective === 'company_user';
        const needsUser = effective === 'user' || effective === 'company_user';

        if (needsCompany && (!companyId || Number.isNaN(companyId))) {
            throw new ForbiddenError('Session has no valid company');
        }
        if (needsUser && !ctx.userId) {
            throw new ForbiddenError('Session has no valid user');
        }

        let scoped = query;
        if (needsCompany) scoped = this.filterByCompany(scoped, companyId);
        if (needsUser) scoped = this.filterByUser(scoped, ctx.userId);
        return scoped;
    }
}

export abstract class BaseRepository extends BaseQueryFilter {
    /**
     * Row scope for repositories that already call this. Kept as a thin alias so
     * existing call sites keep working — prefer `scoped()` in new code.
     *
     * Scoping comes from the repository's declared `scope` (default `'company'`).
     * `bypassScope` is the caller's already-resolved `is_super_user` flag — the
     * only exception. No role names are consulted anywhere.
     */
    protected applyFilter<T>(
        query: T,
        ctx: RequestContext,
        bypassScope = false,
    ): T {
        return this.applyScope(query, ctx, { bypass: bypassScope });
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
