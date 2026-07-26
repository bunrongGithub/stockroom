/**
 * Core Query Framework — wire-level types.
 *
 * This file is type-only + constants and imports nothing, so it is safe to
 * import from client components, pure unit tests, and server code alike.
 *
 * The flow through the framework:
 *
 *   URLSearchParams ──parse.ts──▶ QueryObject ──validate.ts──▶ ValidatedQuery
 *       ──plan.ts──▶ QueryPlan ──apply.ts──▶ Supabase builder
 *
 * Everything up to QueryPlan is pure and unit-testable without Supabase.
 */

export type SortDirection = 'asc' | 'desc';

export type SortField = {
    field: string;
    direction: SortDirection;
};

/** Operators a client may attach to a filter value as an `op:` prefix. */
export const COMPARISON_OPERATORS = [
    'eq',
    'neq',
    'gt',
    'gte',
    'lt',
    'lte',
    'like', // case-insensitive contains (ilike)
    'in',
    'nin',
    'between',
    'is_null',
    'not_null',
] as const;
export type ComparisonOperator = (typeof COMPARISON_OPERATORS)[number];

/**
 * Named date ranges usable as bare filter values on date-typed fields:
 * `filter[created_at]=this_month`. A custom range is expressed with
 * `between:2026-01-01,2026-01-31` — no separate operator.
 */
export const DATE_NAMED_OPERATORS = [
    'today',
    'yesterday',
    'this_week',
    'last_week',
    'this_month',
    'last_month',
    'this_year',
    'last_year',
] as const;
export type DateNamedOperator = (typeof DATE_NAMED_OPERATORS)[number];

export type FilterOperator = ComparisonOperator | DateNamedOperator;

export type FilterValue =
    | string
    | number
    | boolean
    | null
    | (string | number)[];

export type FilterCondition = {
    /** Registered filterable key, e.g. 'status' or 'category_name'. */
    field: string;
    operator: FilterOperator;
    value: FilterValue;
};

/**
 * Soft-delete readiness hook. Parsed and carried through the framework but
 * intentionally NOT applied anywhere yet — when soft delete lands, plan.ts
 * turns this into a condition on `QueryConfig.statusField` without any
 * caller-side changes.
 */
export const STATUS_SCOPES = [
    'active',
    'inactive',
    'archived',
    'deleted',
    'all',
] as const;
export type StatusScope = (typeof STATUS_SCOPES)[number];

/**
 * The one reusable query object a repository receives instead of loose
 * arguments. Produced by parse.ts from the standardized wire format:
 *
 *   ?page=1&limit=10&search=iphone&sort=-created_at,item_name
 *   &fields=id,item_code&include=category,warehouse
 *   &filter[status]=active&filter[category_id]=in:1,2
 *   &filter[created_at]=this_month&filter[price]=gte:100
 */
export type QueryObject = {
    page: number;
    limit: number;
    search?: string;
    sort: SortField[];
    filters: FilterCondition[];
    /** Projection; undefined = the repository's default select. */
    fields?: string[];
    /** Relation keys to embed (allowlisted per repository). */
    include?: string[];
    statusScope?: StatusScope;
};

/** An empty query — page 1, default limit, no constraints. */
export function emptyQuery(overrides: Partial<QueryObject> = {}): QueryObject {
    return { page: 1, limit: 10, sort: [], filters: [], ...overrides };
}

// ── Query plan ──────────────────────────────────────────────────────────────

/**
 * One executable condition. `column` may be a dotted embed path
 * ('category.name') — postgrest-js accepts those on every filter method,
 * so no string interpolation is ever needed for filters.
 */
export type PlanCondition =
    | {
          method: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'ilike';
          column: string;
          value: string | number | boolean;
      }
    | { method: 'in' | 'not_in'; column: string; values: (string | number)[] }
    | { method: 'is' | 'not_is'; column: string; value: null };

/**
 * The pure output of plan.ts — everything apply.ts executes against a
 * Supabase builder. Fully assertable in unit tests without a database.
 */
export type QueryPlan = {
    /** Full PostgREST select string incl. embeds and `!inner` promotions. */
    select: string;
    conditions: PlanCondition[];
    /** Sanitized multi-column global-search expression for `.or()`. */
    orExpression?: string;
    order: { column: string; ascending: boolean }[];
    /** null = unpaginated (the export/aggregate path). */
    range: { from: number; to: number } | null;
};
