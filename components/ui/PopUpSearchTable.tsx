'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { usePopUpSearch } from './PopUpSearch';
import { Button } from './button';
import {
    Pagination,
    PaginationContent,
    PaginationItem,
} from './pagination';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from './select';

export type PopUpSearchTableColumn<T> = {
    key: string;
    header: string;
    /** Custom cell renderer. Defaults to string coercion of `row[key]`. */
    cell?: (row: T) => React.ReactNode;
    /** Extract a plain string for client-side column filtering. */
    getValue?: (row: T) => string;
    /** Show a per-column filter input in the second header row. */
    filterable?: boolean;
    className?: string;
};

type PopUpSearchTableProps<T extends Record<string, unknown>> = {
    apiUrl: string;
    columns: PopUpSearchTableColumn<T>[];
    /** Key used as the row identifier. Defaults to `'id'`. */
    idKey?: string;
    /** Highlight the row whose id matches this value. */
    selectedId?: string | number | null;
    onRowSelect: (row: T) => void;
    /** Set true when the API returns { data: [...] } instead of { data: { data: [...] } }. */
    flatData?: boolean;
    pageSize?: number;
    pageSizeOptions?: number[];
};

type PaginationMeta = {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
};

type ApiResponse<T> = {
    data?: T[] | { data?: T[]; meta?: PaginationMeta };
    meta?: PaginationMeta;
};

export function PopUpSearchTable<T extends Record<string, unknown>>({
    apiUrl,
    columns,
    idKey = 'id',
    selectedId,
    onRowSelect,
    flatData = false,
    pageSize: pageSizeProp = 10,
    pageSizeOptions = [5, 10, 20, 50],
}: PopUpSearchTableProps<T>) {
    const { searchTerm } = usePopUpSearch();

    const [data, setData] = useState<T[]>([]);
    const [meta, setMeta] = useState<PaginationMeta | null>(null);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(pageSizeProp);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
    const previousSearchTerm = useRef(searchTerm);

    const hasColumnFilters = columns.some((c) => c.filterable);

    // Fetch from server whenever the global search term or page changes.
    useEffect(() => {
        const controller = new AbortController();
        const timeout = window.setTimeout(async () => {
            try {
                if (previousSearchTerm.current !== searchTerm) {
                    previousSearchTerm.current = searchTerm;
                    if (page !== 1) {
                        setPage(1);
                        return;
                    }
                }

                setLoading(true);
                setError('');
                const url = new URL(apiUrl, window.location.origin);
                url.searchParams.set('search', searchTerm);
                url.searchParams.set('page', String(page));
                url.searchParams.set('limit', String(pageSize));

                const res = await fetch(url.toString(), {
                    signal: controller.signal,
                });
                if (!res.ok) throw new Error('Failed to fetch');
                const json = (await res.json()) as ApiResponse<T>;
                const rows = Array.isArray(json.data)
                    ? json.data
                    : (json.data?.data ?? []);
                setData(rows);
                setMeta(
                    json.meta ??
                        (!flatData && !Array.isArray(json.data)
                            ? (json.data?.meta ?? null)
                            : null),
                );
            } catch (err) {
                if (err instanceof Error && err.name === 'AbortError') return;
                setError('Failed to fetch data. Please try again.');
            } finally {
                setLoading(false);
            }
        }, 300);

        return () => {
            controller.abort();
            window.clearTimeout(timeout);
        };
    }, [apiUrl, searchTerm, flatData, page, pageSize]);

    // Apply per-column filters client-side on top of server results.
    const filtered = useMemo(() => {
        return data.filter((row) =>
            columns.every((col) => {
                const filterVal = columnFilters[col.key];
                if (!filterVal || !col.filterable) return true;
                const cellStr = col.getValue
                    ? col.getValue(row)
                    : String(row[col.key] ?? '');
                return cellStr.toLowerCase().includes(filterVal.toLowerCase());
            }),
        );
    }, [data, columnFilters, columns]);

    const setFilter = (key: string, value: string) =>
        setColumnFilters((prev) => ({ ...prev, [key]: value }));

    const totalPages = meta?.totalPages ?? 1;
    const safePage = meta?.page ?? page;
    const displayTotal = meta?.total ?? filtered.length;
    const from = displayTotal === 0 ? 0 : (safePage - 1) * pageSize + 1;
    const to = Math.min(safePage * pageSize, displayTotal);

    const pageNumbers = useMemo(() => {
        if (totalPages <= 7)
            return Array.from({ length: totalPages }, (_, i) => i + 1);
        const pages: (number | '…')[] = [1];
        if (safePage > 3) pages.push('…');
        for (
            let i = Math.max(2, safePage - 1);
            i <= Math.min(totalPages - 1, safePage + 1);
            i++
        ) {
            pages.push(i);
        }
        if (safePage < totalPages - 2) pages.push('…');
        pages.push(totalPages);
        return pages;
    }, [totalPages, safePage]);

    const handlePageSizeChange = (size: number) => {
        setPageSize(size);
        setPage(1);
    };

    return (
        <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-sm">
                <thead>
                    {/* Column headers */}
                    <tr className="border-b border-slate-200 bg-slate-50">
                        {columns.map((col) => (
                            <th
                                key={col.key}
                                className={cn(
                                    'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500',
                                    col.className,
                                )}
                            >
                                {col.header}
                            </th>
                        ))}
                    </tr>
                    {hasColumnFilters && (
                        <tr className="border-b border-slate-100 bg-white">
                            {columns.map((col) => (
                                <th key={`${col.key}-filter`} className="px-4 py-2">
                                    {col.filterable ? (
                                        <input
                                            type="text"
                                            value={columnFilters[col.key] ?? ''}
                                            onChange={(e) =>
                                                setFilter(col.key, e.target.value)
                                            }
                                            placeholder={`Filter ${col.header}`}
                                            className="h-8 w-full rounded-lg border border-slate-200 px-2 text-xs font-normal text-slate-700 outline-none transition focus:border-[#1a9e52] focus:ring-2 focus:ring-[#1a9e52]/10"
                                        />
                                    ) : null}
                                </th>
                            ))}
                        </tr>
                    )}
                </thead>

                <tbody>
                    {loading ? (
                        <tr>
                            <td colSpan={columns.length} className="py-12 text-center">
                                <Loader2
                                    size={20}
                                    className="mx-auto animate-spin text-slate-400"
                                />
                            </td>
                        </tr>
                    ) : error ? (
                        <tr>
                            <td colSpan={columns.length} className="px-4 py-4">
                                <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                                    {error}
                                </div>
                            </td>
                        </tr>
                    ) : filtered.length === 0 ? (
                        <tr>
                            <td
                                colSpan={columns.length}
                                className="py-12 text-center text-sm text-slate-400"
                            >
                                មិនមានទិន្នន័យ
                            </td>
                        </tr>
                    ) : (
                        filtered.map((row) => {
                            const rowId = row[idKey];
                            const isActive =
                                String(rowId) === String(selectedId ?? '');

                            return (
                                <tr
                                    key={String(rowId)}
                                    onClick={() => onRowSelect(row)}
                                    className={cn(
                                        'cursor-pointer transition-colors',
                                        isActive
                                            ? 'bg-[#1a9e52]/10 text-[#157845]'
                                            : 'hover:bg-slate-50',
                                    )}
                                >
                                    {columns.map((col) => (
                                        <td
                                            key={col.key}
                                            className={cn('px-4 py-3', col.className)}
                                        >
                                            {col.cell
                                                ? col.cell(row)
                                                : String(row[col.key] ?? '')}
                                        </td>
                                    ))}
                                </tr>
                            );
                        })
                    )}
                </tbody>
            </table>

            {!loading && !error && (data.length > 0 || meta) && (
                <div className="flex flex-col gap-4 border-t border-slate-100 bg-slate-50 px-4 py-3 text-xs text-gray-900 sm:flex-row sm:items-center sm:justify-between">
                    <p>
                        {displayTotal === 0
                            ? 'No records'
                            : meta
                              ? `${from}–${to} of ${displayTotal} record${displayTotal !== 1 ? 's' : ''}`
                              : filtered.length !== data.length
                                ? `${filtered.length} of ${data.length} records`
                                : `${data.length} record${data.length !== 1 ? 's' : ''}`}
                    </p>

                    {meta && (
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                            <div className="flex items-center gap-2">
                                <span>Rows per page</span>
                                <Select
                                    value={String(pageSize)}
                                    onValueChange={(v) =>
                                        handlePageSizeChange(Number(v))
                                    }
                                >
                                    <SelectTrigger className="h-9 w-16 text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="w-10 border-none p-0 text-xs">
                                        {pageSizeOptions.map((s) => (
                                            <SelectItem
                                                key={s}
                                                value={String(s)}
                                                className="border-none text-xs"
                                            >
                                                {s}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {totalPages > 1 && (
                                <Pagination className="mx-0 w-auto justify-start sm:justify-end">
                                    <PaginationContent className="gap-1">
                                        <PaginationItem>
                                            <Button
                                                variant="ghost"
                                                className="h-10 rounded-xl px-2"
                                                onClick={() =>
                                                    setPage(
                                                        Math.max(
                                                            1,
                                                            safePage - 1,
                                                        ),
                                                    )
                                                }
                                                disabled={safePage === 1}
                                            >
                                                <ChevronLeft className="size-5" />
                                                Previous
                                            </Button>
                                        </PaginationItem>

                                        {pageNumbers.map((p, i) =>
                                            p === '…' ? (
                                                <PaginationItem
                                                    key={`ellipsis-${i}`}
                                                >
                                                    <span className="flex size-10 items-center justify-center">
                                                        …
                                                    </span>
                                                </PaginationItem>
                                            ) : (
                                                <PaginationItem key={p}>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className={cn(
                                                            'size-8 rounded-xl bg-gray-200',
                                                            safePage === p &&
                                                                'shadow-[0_0_0_1px_rgba(255,255,255,0.08)]',
                                                        )}
                                                        onClick={() =>
                                                            setPage(p)
                                                        }
                                                    >
                                                        {p}
                                                    </Button>
                                                </PaginationItem>
                                            ),
                                        )}

                                        <PaginationItem>
                                            <Button
                                                variant="ghost"
                                                className="h-10 rounded-xl px-2"
                                                onClick={() =>
                                                    setPage(
                                                        Math.min(
                                                            totalPages,
                                                            safePage + 1,
                                                        ),
                                                    )
                                                }
                                                disabled={
                                                    safePage === totalPages
                                                }
                                            >
                                                Next
                                                <ChevronRight className="size-5" />
                                            </Button>
                                        </PaginationItem>
                                    </PaginationContent>
                                </Pagination>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
