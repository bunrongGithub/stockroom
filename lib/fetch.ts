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

    const url = `${endpoint}?${queryParams.toString()}`;
    const response = await serverFetch(url);

    if (!response.ok) {
        throw new Error(
            `Failed to fetch ${endpoint}: ${response.status} ${response.statusText}`,
        );
    }

    return response.json();
}
