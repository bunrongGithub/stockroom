'use client';

/**
 * URL-synced server list state for the Query Framework.
 *
 * One hook owns the whole list lifecycle: state (page/limit/search/sort/
 * filters) hydrates from the URL, every change re-fetches from the module's
 * list endpoint (debounced for search, abortable always), and the URL is
 * kept in sync via history.replaceState — so the list is bookmarkable and a
 * hard reload restores it (the catch-all page's fetchPaginatedData forwards
 * the same params server-side).
 *
 *     const table = useTableQuery<InventoryUom>({
 *         endpoint: apiBase,
 *         initialData,
 *         initialMeta,
 *     });
 *     <DataTable serverQuery={table.binding} ... data={table.data} />
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
    parseTableQueryState,
    serializeTableQuery,
    serializeTableRequest,
    type TableQueryState,
    type TableSortState,
} from '@/lib/query/serialize';
import type { TMeta } from '@/types/app';

const DEFAULT_META: TMeta = { total: 0, page: 1, limit: 10, totalPages: 0 };

export type UseTableQueryOptions<T> = {
    /** List endpoint, e.g. `/api/inventory/configurations/uom`. */
    endpoint: string;
    /** Server-preloaded first page (from the catch-all page). null = the
     *  server-side load failed or was skipped — fetch on mount instead. */
    initialData?: T[] | null;
    initialMeta?: TMeta | null;
    defaultLimit?: number;
    defaultSort?: TableSortState[];
    /** Keep the URL in sync with the list state. Default true. */
    syncToUrl?: boolean;
};

/** The slice DataTable's serverQuery mode consumes. */
export type ServerQueryBinding = {
    state: TableQueryState;
    total: number;
    totalPages: number;
    loading: boolean;
    onSearch: (search: string) => void;
    onToggleSort: (field: string) => void;
    onFilter: (key: string, value: string | null) => void;
    onPageChange: (page: number) => void;
    onPageSizeChange: (limit: number) => void;
};

export function useTableQuery<T>(options: UseTableQueryOptions<T>) {
    const {
        endpoint,
        initialData,
        initialMeta,
        defaultLimit,
        defaultSort,
        syncToUrl = true,
    } = options;

    const searchParams = useSearchParams();
    const [state, setState] = useState<TableQueryState>(() =>
        parseTableQueryState(new URLSearchParams(searchParams.toString()), {
            limit: defaultLimit ?? initialMeta?.limit,
            sort: defaultSort,
        }),
    );
    const [data, setData] = useState<T[]>(initialData ?? []);
    const [meta, setMeta] = useState<TMeta>(
        () => initialMeta ?? { ...DEFAULT_META, limit: defaultLimit ?? 10 },
    );
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const abortRef = useRef<AbortController | null>(null);
    const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // The server already rendered page 1 for the current URL — skip the
    // duplicate fetch on mount when that preload exists.
    const skipNextFetchRef = useRef(initialData != null);

    const fetchList = useCallback(
        async (target: TableQueryState) => {
            abortRef.current?.abort();
            const controller = new AbortController();
            abortRef.current = controller;

            setLoading(true);
            setError(null);
            try {
                const qs = serializeTableRequest(target).toString();
                const response = await fetch(`${endpoint}?${qs}`, {
                    signal: controller.signal,
                });
                const json = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(
                        typeof json.error === 'string'
                            ? json.error
                            : `Request failed (${response.status})`,
                    );
                }
                setData(json.data ?? []);
                setMeta(json.meta ?? DEFAULT_META);
            } catch (err) {
                if (err instanceof DOMException && err.name === 'AbortError') {
                    return;
                }
                setError(err instanceof Error ? err.message : 'Request failed');
            } finally {
                if (abortRef.current === controller) setLoading(false);
            }
        },
        [endpoint],
    );

    useEffect(() => {
        if (skipNextFetchRef.current) {
            skipNextFetchRef.current = false;
        } else {
            fetchList(state);
        }

        if (syncToUrl && typeof window !== 'undefined') {
            const qs = serializeTableQuery(state).toString();
            const next = qs
                ? `${window.location.pathname}?${qs}`
                : window.location.pathname;
            const current = `${window.location.pathname}${window.location.search}`;
            if (next !== current) {
                // history.replaceState keeps this shallow: no server
                // round-trip, next/navigation's useSearchParams stays in sync.
                window.history.replaceState(null, '', next);
            }
        }
    }, [state, fetchList, syncToUrl]);

    useEffect(() => {
        return () => {
            abortRef.current?.abort();
            if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        };
    }, []);

    const setSearch = useCallback((search: string) => {
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        searchTimerRef.current = setTimeout(() => {
            const trimmed = search.trim();
            setState((prev) =>
                prev.search === trimmed
                    ? prev
                    : { ...prev, search: trimmed, page: 1 },
            );
        }, 300);
    }, []);

    /** asc → desc → off (single-column sort from the UI). */
    const toggleSort = useCallback((field: string) => {
        setState((prev) => {
            const current = prev.sort.find((s) => s.field === field);
            const sort: TableSortState[] =
                current === undefined
                    ? [{ field, direction: 'asc' }]
                    : current.direction === 'asc'
                      ? [{ field, direction: 'desc' }]
                      : [];
            return { ...prev, sort, page: 1 };
        });
    }, []);

    const setFilter = useCallback((key: string, value: string | null) => {
        setState((prev) => {
            const filters = { ...prev.filters };
            if (value) filters[key] = value;
            else delete filters[key];
            return { ...prev, filters, page: 1 };
        });
    }, []);

    const setPage = useCallback((page: number) => {
        setState((prev) => ({ ...prev, page }));
    }, []);

    const setLimit = useCallback((limit: number) => {
        setState((prev) => ({ ...prev, limit, page: 1 }));
    }, []);

    const refresh = useCallback(() => fetchList(state), [fetchList, state]);

    const binding: ServerQueryBinding = useMemo(
        () => ({
            state,
            total: meta.total,
            totalPages: meta.totalPages,
            loading,
            onSearch: setSearch,
            onToggleSort: toggleSort,
            onFilter: setFilter,
            onPageChange: setPage,
            onPageSizeChange: setLimit,
        }),
        [state, meta, loading, setSearch, toggleSort, setFilter, setPage, setLimit],
    );

    return {
        data,
        meta,
        loading,
        error,
        state,
        binding,
        setSearch,
        toggleSort,
        setFilter,
        setPage,
        setLimit,
        refresh,
    };
}
