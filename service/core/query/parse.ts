/**
 * Wire format → QueryObject. Pure: takes URLSearchParams, returns data.
 *
 * Parsing is deliberately permissive (malformed pieces are dropped, unknown
 * params ignored); STRICTNESS lives in validate.ts, where everything is
 * checked against the repository's QueryConfig and rejected with a 400.
 */

import {
    COMPARISON_OPERATORS,
    DATE_NAMED_OPERATORS,
    STATUS_SCOPES,
    type ComparisonOperator,
    type DateNamedOperator,
    type FilterCondition,
    type QueryObject,
    type SortField,
    type StatusScope,
} from './types.ts';

export const DEFAULT_PAGE_LIMIT = 10;

/** filter[field] — field limited to identifier chars so the key itself can never smuggle syntax. */
const FILTER_KEY_PATTERN = /^filter\[([A-Za-z0-9_]+)\]$/;
const IDENTIFIER_PATTERN = /^[A-Za-z0-9_]+$/;

const COMPARISON_SET = new Set<string>(COMPARISON_OPERATORS);
const DATE_NAMED_SET = new Set<string>(DATE_NAMED_OPERATORS);
const STATUS_SCOPE_SET = new Set<string>(STATUS_SCOPES);

function parsePositiveInt(raw: string | null, fallback: number): number {
    const value = Number(raw);
    return Number.isInteger(value) && value > 0 ? value : fallback;
}

/** `-created_at,item_name` → [{created_at desc}, {item_name asc}] */
export function parseSort(raw: string | null): SortField[] {
    if (!raw) return [];
    const fields: SortField[] = [];
    for (const part of raw.split(',')) {
        const trimmed = part.trim();
        if (!trimmed) continue;
        const descending = trimmed.startsWith('-');
        const field = descending ? trimmed.slice(1) : trimmed;
        if (!IDENTIFIER_PATTERN.test(field)) continue;
        fields.push({ field, direction: descending ? 'desc' : 'asc' });
    }
    return fields;
}

function parseCsvIdentifiers(raw: string | null): string[] | undefined {
    if (!raw) return undefined;
    const items = raw
        .split(',')
        .map((s) => s.trim())
        .filter((s) => IDENTIFIER_PATTERN.test(s));
    return items.length > 0 ? items : undefined;
}

function splitList(raw: string): (string | number)[] {
    return raw
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
}

/**
 * Filter value syntax: `op:value` prefix, default op = eq.
 *   status=active            → eq 'active'
 *   price=gte:100            → gte '100'
 *   category_id=in:1,2       → in ['1','2']
 *   created_at=between:a,b   → between ['a','b']
 *   deleted_at=is_null       → is_null
 *   created_at=this_month    → named date operator
 */
export function parseFilterValue(
    field: string,
    raw: string,
): FilterCondition | null {
    if (raw === 'is_null' || raw === 'not_null') {
        return { field, operator: raw, value: null };
    }
    if (DATE_NAMED_SET.has(raw)) {
        return { field, operator: raw as DateNamedOperator, value: null };
    }

    const colon = raw.indexOf(':');
    if (colon > 0) {
        const prefix = raw.slice(0, colon);
        if (COMPARISON_SET.has(prefix)) {
            const operator = prefix as ComparisonOperator;
            const rest = raw.slice(colon + 1);
            if (operator === 'is_null' || operator === 'not_null') {
                return { field, operator, value: null };
            }
            if (operator === 'in' || operator === 'nin') {
                const values = splitList(rest);
                return values.length > 0
                    ? { field, operator, value: values }
                    : null;
            }
            if (operator === 'between') {
                const values = splitList(rest);
                return values.length === 2
                    ? { field, operator, value: values }
                    : null;
            }
            return rest.length > 0 ? { field, operator, value: rest } : null;
        }
        // Unknown prefix: the colon belongs to the value ("eq" semantics).
    }

    return raw.length > 0 ? { field, operator: 'eq', value: raw } : null;
}

/** Parse the standardized list wire format into a QueryObject. */
export function parseListQuery(searchParams: URLSearchParams): QueryObject {
    const filters: FilterCondition[] = [];
    for (const [key, value] of searchParams.entries()) {
        const match = FILTER_KEY_PATTERN.exec(key);
        if (!match) continue;
        const condition = parseFilterValue(match[1], value.trim());
        if (condition) filters.push(condition);
    }

    const search = searchParams.get('search')?.trim();
    const statusScopeRaw = searchParams.get('status_scope');

    return {
        page: parsePositiveInt(searchParams.get('page'), 1),
        limit: parsePositiveInt(searchParams.get('limit'), DEFAULT_PAGE_LIMIT),
        search: search || undefined,
        sort: parseSort(searchParams.get('sort')),
        filters,
        fields: parseCsvIdentifiers(searchParams.get('fields')),
        include: parseCsvIdentifiers(searchParams.get('include')),
        statusScope:
            statusScopeRaw && STATUS_SCOPE_SET.has(statusScopeRaw)
                ? (statusScopeRaw as StatusScope)
                : undefined,
    };
}
