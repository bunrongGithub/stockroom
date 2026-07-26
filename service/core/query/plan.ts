/**
 * ValidatedQuery × QueryConfig → QueryPlan. Pure — the entire query shape
 * (select string, conditions, search expression, order, range) is computed
 * here and unit-tested without Supabase; apply.ts only executes it.
 */

import dayjs from 'dayjs';
import type { QueryConfig, RelationConfig } from './config.ts';
import { isDateFieldType } from './config.ts';
import {
    resolveBetweenRange,
    resolveDateRange,
    resolveDayRange,
} from './date-range.ts';
import type {
    DateNamedOperator,
    FilterOperator,
    PlanCondition,
    QueryPlan,
    SortField,
} from './types.ts';
import { DATE_NAMED_OPERATORS } from './types.ts';

function isNamedDateOperator(
    operator: FilterOperator,
): operator is DateNamedOperator {
    return (DATE_NAMED_OPERATORS as readonly string[]).includes(operator);
}
import type { ValidatedFilter, ValidatedQuery } from './validate.ts';

export type PlanOptions = {
    /** false → range: null (the export / aggregate path). Default true. */
    paginate?: boolean;
    /** Injectable clock for named date operators (tests). ISO string. */
    now?: string;
};

const FALLBACK_SORT: SortField[] = [{ field: 'id', direction: 'desc' }];

/**
 * The `.or()` search expression is the framework's ONE string-interpolated
 * surface, so the term is stripped of every character that carries meaning
 * in PostgREST filter syntax (generalizes the uom.ts precedent).
 */
export function sanitizeSearchTerm(term: string): string {
    return term.replace(/[%,()]/g, '').trim();
}

function buildSearchExpression(
    search: string | undefined,
    columns: string[],
): string | undefined {
    if (!search || columns.length === 0) return undefined;
    const term = sanitizeSearchTerm(search);
    if (!term) return undefined;
    return columns.map((column) => `${column}.ilike.%${term}%`).join(',');
}

function relationEmbed(
    key: string,
    relation: RelationConfig,
    inner: boolean,
): string {
    const target = relation.fkHint ?? relation.table;
    return `${key}:${target}${inner ? '!inner' : ''}(${relation.columns.join(',')})`;
}

function buildSelect(
    query: ValidatedQuery,
    config: QueryConfig,
): string {
    // Root projection: explicit fields always carry `id` so keyExtractors,
    // row actions, and audit joins keep working.
    const root = query.fields
        ? Array.from(new Set(['id', ...query.fields])).join(',')
        : (config.defaultSelect ?? '*');

    if (!config.relations) return root;

    // Relations filtered on must be embedded with `!inner` (otherwise
    // PostgREST filters the embed, not the rows). Plain includes stay left
    // joins so rows with a NULL relation are not dropped.
    const innerKeys = new Set(
        query.filters
            .map((filter) => filter.relation)
            .filter((key): key is string => Boolean(key)),
    );
    const embedKeys = new Set<string>(innerKeys);
    for (const key of query.include) embedKeys.add(key);
    for (const [key, relation] of Object.entries(config.relations)) {
        if (relation.always) embedKeys.add(key);
    }

    const embeds = Array.from(embedKeys)
        .sort()
        .map((key) =>
            relationEmbed(key, config.relations![key], innerKeys.has(key)),
        );

    return embeds.length > 0 ? [root, ...embeds].join(', ') : root;
}

function conditionColumn(filter: ValidatedFilter): string {
    return filter.relation ? `${filter.relation}.${filter.column}` : filter.column;
}

function rangePair(
    column: string,
    from: string,
    to: string,
): PlanCondition[] {
    return [
        { method: 'gte', column, value: from },
        { method: 'lte', column, value: to },
    ];
}

function filterConditions(
    filter: ValidatedFilter,
    now?: string,
): PlanCondition[] {
    const column = conditionColumn(filter);
    const { operator, value } = filter;

    if (isNamedDateOperator(operator)) {
        const range = resolveDateRange(operator, now ? dayjs(now) : undefined);
        return rangePair(column, range.from, range.to);
    }

    switch (operator) {
        case 'is_null':
            return [{ method: 'is', column, value: null }];
        case 'not_null':
            return [{ method: 'not_is', column, value: null }];
        case 'in':
        case 'nin':
            return [
                {
                    method: operator === 'in' ? 'in' : 'not_in',
                    column,
                    values: value as (string | number)[],
                },
            ];
        case 'between': {
            const [from, to] = value as (string | number)[];
            if (isDateFieldType(filter.type)) {
                const range = resolveBetweenRange(String(from), String(to));
                if (range) return rangePair(column, range.from, range.to);
            }
            return [
                { method: 'gte', column, value: from },
                { method: 'lte', column, value: to },
            ];
        }
        case 'eq': {
            if (value === null) return [{ method: 'is', column, value: null }];
            // eq on a timestamp column would match one exact instant; a
            // calendar date means "that whole day".
            if (isDateFieldType(filter.type)) {
                const range = resolveDayRange(String(value));
                if (range) return rangePair(column, range.from, range.to);
            }
            return [
                { method: 'eq', column, value: value as string | number | boolean },
            ];
        }
        case 'like': {
            const term = sanitizeSearchTerm(String(value));
            if (!term) return [];
            return [{ method: 'ilike', column, value: `%${term}%` }];
        }
        default:
            return [
                {
                    method: operator,
                    column,
                    value: value as string | number | boolean,
                },
            ];
    }
}

export function buildQueryPlan(
    query: ValidatedQuery,
    config: QueryConfig,
    options: PlanOptions = {},
): QueryPlan {
    const paginate = options.paginate ?? true;

    const conditions = query.filters.flatMap((filter) =>
        filterConditions(filter, options.now),
    );

    const sort =
        query.sort.length > 0
            ? query.sort
            : (config.defaultSort ?? FALLBACK_SORT);

    const from = (query.page - 1) * query.limit;

    // NOTE: statusScope is intentionally not translated yet — soft delete is
    // a future enhancement; when it lands, map query.statusScope onto
    // config.statusField.column here and nowhere else.

    return {
        select: buildSelect(query, config),
        conditions,
        orExpression: buildSearchExpression(query.search, config.searchable),
        order: sort.map((item) => ({
            column: item.field,
            ascending: item.direction === 'asc',
        })),
        range: paginate ? { from, to: from + query.limit - 1 } : null,
    };
}
