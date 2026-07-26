'use client';

/**
 * Accumulating paged fetch — the repo's first infinite-scroll primitive.
 *
 * Speaks the same `?search=&page=&limit=` contract every paginated list
 * endpoint already serves, and appends each page instead of replacing it, so a
 * dropdown can keep scrolling without a pager. Generic on purpose: the partner
 * lookup is the first consumer, not the only one.
 *
 *     const { items, loading, hasMore, loadMore, reset } =
 *         useInfiniteQuery<Row>({ endpoint: '/api/…/lookup', search, params: { role } });
 */

import { useCallback, useEffect, useRef, useState } from 'react';

type Meta = { total: number; page: number; limit: number; totalPages: number };

export type UseInfiniteQueryOptions = {
    endpoint: string;
    /** Debounced free-text query; a change restarts from page 1. */
    search?: string;
    /** Extra static query params (e.g. `{ role: 'customer' }`). */
    params?: Record<string, string | number | undefined>;
    limit?: number;
    /** Skip fetching entirely (e.g. while a dropdown is closed). */
    enabled?: boolean;
    debounceMs?: number;
};

export function useInfiniteQuery<T>({
    endpoint,
    search = '',
    params,
    limit = 20,
    enabled = true,
    debounceMs = 250,
}: UseInfiniteQueryOptions) {
    const [items, setItems] = useState<T[]>([]);
    const [meta, setMeta] = useState<Meta | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Guards against the two classic infinite-scroll bugs: a slow page 1
    // landing after a newer search (stale overwrite), and the sentinel firing
    // twice for the same page (duplicate rows).
    const abortRef = useRef<AbortController | null>(null);
    const requestIdRef = useRef(0);
    const inFlightPage = useRef<number | null>(null);

    const paramsKey = JSON.stringify(params ?? {});

    const fetchPage = useCallback(
        async (page: number, replace: boolean) => {
            if (!enabled) return;
            if (inFlightPage.current === page) return;
            inFlightPage.current = page;

            abortRef.current?.abort();
            const controller = new AbortController();
            abortRef.current = controller;
            const requestId = ++requestIdRef.current;

            setLoading(true);
            setError(null);
            try {
                const url = new URL(endpoint, window.location.origin);
                for (const [k, v] of Object.entries(
                    JSON.parse(paramsKey) as Record<string, string | number | undefined>,
                )) {
                    if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
                }
                if (search.trim()) url.searchParams.set('search', search.trim());
                url.searchParams.set('page', String(page));
                url.searchParams.set('limit', String(limit));

                const res = await fetch(url.toString(), { signal: controller.signal });
                if (!res.ok) throw new Error(`Lookup failed (${res.status})`);
                const json = await res.json();

                // Ignore a response that a newer request has already superseded.
                if (requestId !== requestIdRef.current) return;

                const rows: T[] = json.data ?? [];
                setItems((prev) => (replace ? rows : [...prev, ...rows]));
                setMeta(json.meta ?? null);
            } catch (e) {
                if ((e as Error).name === 'AbortError') return;
                if (requestId === requestIdRef.current) {
                    setError(e instanceof Error ? e.message : 'Lookup failed');
                }
            } finally {
                if (requestId === requestIdRef.current) setLoading(false);
                inFlightPage.current = null;
            }
        },
        [endpoint, search, paramsKey, limit, enabled],
    );

    // A new search term restarts the list — debounced so typing doesn't
    // hammer the endpoint.
    useEffect(() => {
        if (!enabled) return;
        const t = setTimeout(() => void fetchPage(1, true), debounceMs);
        return () => clearTimeout(t);
    }, [fetchPage, enabled, debounceMs]);

    useEffect(() => {
        if (!enabled) {
            abortRef.current?.abort();
        }
    }, [enabled]);

    const hasMore = meta ? meta.page < meta.totalPages : false;

    const loadMore = useCallback(() => {
        if (loading || !hasMore || !meta) return;
        void fetchPage(meta.page + 1, false);
    }, [loading, hasMore, meta, fetchPage]);

    const reset = useCallback(() => {
        setItems([]);
        setMeta(null);
    }, []);

    return { items, meta, loading, error, hasMore, loadMore, reset };
}
