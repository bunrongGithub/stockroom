/**
 * Client-side mirror of the Query Framework wire format
 * (service/core/query/parse.ts). Table state lives in this shape, serializes
 * onto the URL, and hydrates back from it — so list state is bookmarkable and
 * survives reloads.
 *
 * Client-safe: no server imports.
 */

export type TableSortState = { field: string; direction: 'asc' | 'desc' };

export type TableQueryState = {
    page: number;
    limit: number;
    search: string;
    sort: TableSortState[];
    /**
     * Raw wire filter values keyed by field, exactly as sent:
     * { status: 'active', price: 'gte:100', created_at: 'this_month' }.
     * null/removed keys are simply absent.
     */
    filters: Record<string, string>;
};

export const DEFAULT_TABLE_LIMIT = 10;

export function serializeTableQuery(state: TableQueryState): URLSearchParams {
    const params = new URLSearchParams();

    if (state.page > 1) params.set('page', String(state.page));
    if (state.limit !== DEFAULT_TABLE_LIMIT) {
        params.set('limit', String(state.limit));
    }
    if (state.search) params.set('search', state.search);
    if (state.sort.length > 0) {
        params.set(
            'sort',
            state.sort
                .map((s) => (s.direction === 'desc' ? `-${s.field}` : s.field))
                .join(','),
        );
    }
    for (const [key, value] of Object.entries(state.filters)) {
        if (value) params.set(`filter[${key}]`, value);
    }

    return params;
}

/** Request params always carry explicit page/limit (URL omits defaults). */
export function serializeTableRequest(state: TableQueryState): URLSearchParams {
    const params = serializeTableQuery(state);
    params.set('page', String(state.page));
    params.set('limit', String(state.limit));
    return params;
}

const FILTER_KEY_PATTERN = /^filter\[([A-Za-z0-9_]+)\]$/;

export function parseTableQueryState(
    searchParams: URLSearchParams,
    defaults: { limit?: number; sort?: TableSortState[] } = {},
): TableQueryState {
    const page = Number(searchParams.get('page'));
    const limit = Number(searchParams.get('limit'));

    const sortRaw = searchParams.get('sort');
    const sort: TableSortState[] = sortRaw
        ? sortRaw
              .split(',')
              .map((part) => part.trim())
              .filter(Boolean)
              .map((part) =>
                  part.startsWith('-')
                      ? { field: part.slice(1), direction: 'desc' as const }
                      : { field: part, direction: 'asc' as const },
              )
        : (defaults.sort ?? []);

    const filters: Record<string, string> = {};
    for (const [key, value] of searchParams.entries()) {
        const match = FILTER_KEY_PATTERN.exec(key);
        if (match && value) filters[match[1]] = value;
    }

    return {
        page: Number.isInteger(page) && page > 0 ? page : 1,
        limit:
            Number.isInteger(limit) && limit > 0
                ? limit
                : (defaults.limit ?? DEFAULT_TABLE_LIMIT),
        search: searchParams.get('search')?.trim() ?? '',
        sort,
        filters,
    };
}
