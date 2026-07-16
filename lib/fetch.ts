import { cookies } from 'next/headers';

export async function serverFetch(
    url: string,
    init?: RequestInit,
): Promise<Response> {
    const cookieStore = await cookies();
    return fetch(url, {
        ...init,
        headers: {
            ...init?.headers,
            cookie: cookieStore.toString(),
        },
    });
}

export interface PaginatedResponse<T> {
    data: T[];
    meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
}

/** Query Framework params forwarded verbatim on the initial server-side load. */
const FORWARDED_PARAMS = ['sort', 'fields', 'include', 'status_scope'] as const;
const FILTER_PARAM_PATTERN = /^filter\[[A-Za-z0-9_]+\]$/;

export async function fetchPaginatedData<T>(
    endpoint: string,
    searchParams: Record<string, string | string[] | undefined>,
): Promise<PaginatedResponse<T>> {
    const page = Number(searchParams.page) || 1;
    const limit = Number(searchParams.limit) || 10;
    const search = searchParams.search || '';

    const queryParams = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        ...(search && { search: String(search) }),
    });

    // Forward the rest of the standardized wire format (sort, filter[...],
    // fields, include) so a bookmarked/reloaded URL restores the full list
    // state, not just page/limit/search.
    for (const [key, value] of Object.entries(searchParams)) {
        if (typeof value !== 'string' || !value) continue;
        const forwarded =
            (FORWARDED_PARAMS as readonly string[]).includes(key) ||
            FILTER_PARAM_PATTERN.test(key);
        if (forwarded) queryParams.set(key, value);
    }

    const url = `${endpoint}?${queryParams.toString()}`;
    const response = await serverFetch(url);

    if (!response.ok) {
        throw new Error(
            `Failed to fetch ${endpoint}: ${response.status} ${response.statusText}`,
        );
    }

    return response.json();
}
