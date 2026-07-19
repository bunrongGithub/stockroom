import { cache } from 'react';
import { PaginationMixin, type PaginatedResult } from './pagination';
import { getServerClient, createScopedClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { RequestContext } from '@/types/request-context';
import { ApiError, ForbiddenError, ValidationError } from './api-response';
import { resolveAuditUsers, type AuditUser } from './audit';
import type { QueryConfig } from './query/config.ts';
import { QueryValidationError } from './query/errors.ts';
import { applyPlan, type PlanQuery } from './query/apply.ts';
import { buildQueryPlan } from './query/plan.ts';
import type { QueryObject, QueryPlan } from './query/types.ts';
import {
    forcedToValidated,
    validateQuery,
    type ForcedCondition,
    type ValidatedQuery,
} from './query/validate.ts';

/** A row carrying the raw audit foreign keys, before enrichment. */
type AuditRow = { created_by?: string | null; updated_by?: string | null };

/** A row after enrichment: the raw ids resolved to display info. */
export type WithAuditUsers<T> = T & {
    created_by_user: AuditUser | null;
    updated_by_user: AuditUser | null;
};

/**
 * A domain object returned by a detail endpoint, carrying the enriched audit
 * fields the AuditInformationCard reads. Domain types already expose
 * created_at/updated_at, so this only adds the resolved user objects (+ the raw
 * ids for completeness).
 */
export type AuditEnriched<T> = T & {
    created_by: string | null;
    updated_by: string | null;
    created_by_user: AuditUser | null;
    updated_by_user: AuditUser | null;
};

// Deduped per request: multiple repositories touched in one render/handler share
// a single `profiles.is_super_user` lookup instead of querying once each.
export const fetchSuperUserFlag = cache(async (userId: string): Promise<boolean> => {
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

    // ── Audit metadata ──────────────────────────────────────────────────────
    // created_by / updated_by are system-managed: set ONLY from the request
    // context, never from client input. Wrap every insert/update payload with
    // these so no repository hand-assigns audit fields.

    /** Stamp a NEW row: both created_by and updated_by = the current user. */
    protected stampCreate<T extends object>(
        ctx: RequestContext,
        payload: T,
    ): T & { created_by: string; updated_by: string } {
        return { ...payload, created_by: ctx.userId, updated_by: ctx.userId };
    }

    /** Stamp an UPDATE: only updated_by. created_by is immutable (DB-enforced). */
    protected stampUpdate<T extends object>(
        ctx: RequestContext,
        payload: T,
    ): T & { updated_by: string } {
        return { ...payload, updated_by: ctx.userId };
    }

    /**
     * Insert one row with audit stamping applied. The zero-boilerplate path for
     * new modules — created_by/updated_by are handled here, not in the caller.
     */
    protected async auditedInsert<R = Record<string, unknown>>(
        ctx: RequestContext,
        table: string,
        payload: Record<string, unknown>,
        select = '*',
    ): Promise<R> {
        const { data, error } = await this.db
            .from(table)
            .insert(this.stampCreate(ctx, payload))
            .select(select)
            .single();
        if (error) throw new ApiError(error.message, 500, error.code);
        return data as R;
    }

    /**
     * Update one row (by id, company-scoped) with audit stamping applied. The
     * DB immutability guard keeps created_by/created_at fixed regardless.
     */
    protected async auditedUpdate<R = Record<string, unknown>>(
        ctx: RequestContext,
        table: string,
        id: number | string,
        patch: Record<string, unknown>,
        select = '*',
    ): Promise<R> {
        const { data, error } = await this.db
            .from(table)
            .update(this.stampUpdate(ctx, patch))
            .eq('id', id)
            .eq('company_id', Number(ctx.companyId))
            .select(select)
            .single();
        if (error) throw new ApiError(error.message, 500, error.code);
        return data as R;
    }

    /**
     * Resolve created_by/updated_by ids to `{ id, full_name, avatar_url }` for a
     * batch of rows in ONE query (no N+1). Returns rows widened with
     * created_by_user / updated_by_user.
     */
    protected async enrichAudit<T extends AuditRow>(
        rows: T[],
    ): Promise<WithAuditUsers<T>[]> {
        const users = await resolveAuditUsers(
            rows.flatMap((r) => [r.created_by, r.updated_by]),
        );
        return rows.map((r) => ({
            ...r,
            created_by_user: r.created_by ? (users[r.created_by] ?? null) : null,
            updated_by_user: r.updated_by ? (users[r.updated_by] ?? null) : null,
        }));
    }

    /** enrichAudit for a single row. */
    protected async enrichAuditOne<T extends AuditRow>(
        row: T,
    ): Promise<WithAuditUsers<T>> {
        return (await this.enrichAudit([row]))[0];
    }

    // ── Core Query Framework ────────────────────────────────────────────────
    // The standardized list path. A repository opts in by declaring
    // `queryConfig`; routes parse the wire format with `parseListParams()`
    // and hand the whole QueryObject to `findAllQuery()`. Search, filtering,
    // sorting, pagination, relation embeds, and tenant scoping all run
    // through one validated pipeline — no per-repo query logic.

    /**
     * Field registry for the Query Framework: which columns are searchable,
     * sortable, filterable (and how), and which relations may be embedded.
     * Anything a client sends that is not registered here is rejected (400).
     */
    protected readonly queryConfig?: QueryConfig;

    private resolveQueryConfig(config?: QueryConfig): QueryConfig {
        const resolved = config ?? this.queryConfig;
        if (!resolved) {
            throw new ApiError(
                'Repository does not declare a queryConfig',
                500,
                'QUERY_CONFIG_MISSING',
            );
        }
        return resolved;
    }

    private validateOrThrow(
        query: QueryObject,
        config: QueryConfig,
        forced?: ForcedCondition[],
    ): ValidatedQuery {
        try {
            const validated = validateQuery(query, config);
            return forced?.length
                ? {
                      ...validated,
                      filters: [
                          ...forced.map(forcedToValidated),
                          ...validated.filters,
                      ],
                  }
                : validated;
        } catch (error) {
            if (error instanceof QueryValidationError) {
                throw new ValidationError(error.message, error.details);
            }
            throw error;
        }
    }

    /**
     * Build the scoped, filtered, searched, and sorted query WITHOUT
     * executing it. This is the shared foundation for listing, export
     * (paginate: false), and aggregation — export must never re-implement
     * the listing filters.
     */
    protected async buildListQuery(
        ctx: RequestContext,
        query: QueryObject,
        options: {
            config?: QueryConfig;
            /** Server-pinned conditions the client cannot override. */
            forced?: ForcedCondition[];
            count?: 'exact' | null;
            paginate?: boolean;
            head?: boolean;
        } = {},
    ): Promise<{ builder: PlanQuery; plan: QueryPlan; validated: ValidatedQuery }> {
        const config = this.resolveQueryConfig(options.config);
        const validated = this.validateOrThrow(query, config, options.forced);
        const plan = buildQueryPlan(validated, config, {
            paginate: options.paginate ?? true,
        });

        const base = this.db.from(config.table).select(plan.select, {
            ...(options.count === null ? {} : { count: options.count ?? 'exact' }),
            ...(options.head ? { head: true } : {}),
        });
        const built = applyPlan(base as unknown as PlanQuery, plan);
        const scoped = this.applyScope(built, ctx, await this.scopeOptions(ctx));

        return { builder: scoped, plan, validated };
    }

    /**
     * The standardized list query: one QueryObject in, `{ data, meta }` out.
     * Meta keeps the app-wide shape { total, page, limit, totalPages }.
     */
    protected async findAllQuery<T = Record<string, unknown>>(
        ctx: RequestContext,
        query: QueryObject,
        options: {
            config?: QueryConfig;
            forced?: ForcedCondition[];
            map?: (row: Record<string, unknown>) => T;
        } = {},
    ): Promise<PaginatedResult<T>> {
        const { builder, validated } = await this.buildListQuery(ctx, query, {
            config: options.config,
            forced: options.forced,
            count: 'exact',
        });

        const { data, error, count } = await (builder as unknown as PromiseLike<{
            data: Record<string, unknown>[] | null;
            error: { message: string; code?: string } | null;
            count: number | null;
        }>);
        if (error) throw new ApiError(error.message, 500, error.code);

        const rows = data ?? [];
        const total = count ?? 0;
        // Call the mapper with the row ONLY — never Array.map's (row, index)
        // signature, which would leak the index into mappers that take an
        // optional second parameter.
        const mapper = options.map;
        return {
            data: (mapper ? rows.map((row) => mapper(row)) : rows) as T[],
            meta: {
                total,
                page: validated.page,
                limit: validated.limit,
                totalPages: Math.ceil(total / validated.limit),
            },
        };
    }

    /**
     * Aggregates over the exact same filtered query as the listing —
     * dashboard widgets reuse list filters instead of bespoke queries.
     * Only 'count' is implemented in this pass; sum/avg/min/max are wired
     * when the first dashboard widget needs them (PostgREST aggregate
     * select syntax `alias:column.sum()`).
     */
    protected async aggregate(
        ctx: RequestContext,
        query: QueryObject,
        specs: {
            fn: 'count' | 'sum' | 'avg' | 'min' | 'max';
            field?: string;
            alias?: string;
        }[],
        options: { config?: QueryConfig; forced?: ForcedCondition[] } = {},
    ): Promise<Record<string, number>> {
        const unsupported = specs.find((spec) => spec.fn !== 'count');
        if (unsupported) {
            throw new ApiError(
                `Aggregate '${unsupported.fn}' is not implemented yet`,
                501,
                'NOT_IMPLEMENTED',
            );
        }

        const { builder } = await this.buildListQuery(ctx, query, {
            config: options.config,
            forced: options.forced,
            count: 'exact',
            paginate: false,
            head: true,
        });
        const { error, count } = await (builder as unknown as PromiseLike<{
            error: { message: string; code?: string } | null;
            count: number | null;
        }>);
        if (error) throw new ApiError(error.message, 500, error.code);

        const result: Record<string, number> = {};
        for (const spec of specs) {
            result[spec.alias ?? 'count'] = count ?? 0;
        }
        return result;
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
