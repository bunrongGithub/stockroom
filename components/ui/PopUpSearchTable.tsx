'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { usePopUpSearch } from './PopUpSearch';

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
};

export function PopUpSearchTable<T extends Record<string, unknown>>({
    apiUrl,
    columns,
    idKey = 'id',
    selectedId,
    onRowSelect,
    flatData = false,
}: PopUpSearchTableProps<T>) {
    const { searchTerm } = usePopUpSearch();

    const [data, setData] = useState<T[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});

    const hasColumnFilters = columns.some((c) => c.filterable);

    // Fetch from server whenever the global search term changes.
    useEffect(() => {
        const controller = new AbortController();
        const timeout = window.setTimeout(async () => {
            try {
                setLoading(true);
                setError('');
                const url = `${apiUrl}?search=${encodeURIComponent(searchTerm)}&limit=50`;
                const res = await fetch(url, { signal: controller.signal });
                if (!res.ok) throw new Error('Failed to fetch');
                const json = await res.json();
                setData(flatData ? (json?.data ?? []) : (json?.data?.data ?? []));
            } catch (err) {
                if (err instanceof Error && err.name === 'AbortError') return;
                setError('មិនអាចទាញយកទិន្នន័យបានទេ។');
            } finally {
                setLoading(false);
            }
        }, 300);

        return () => {
            controller.abort();
            window.clearTimeout(timeout);
        };
    }, [apiUrl, searchTerm, flatData]);

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

            {/* Footer count */}
            {!loading && !error && data.length > 0 && (
                <div className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-right text-xs text-slate-400">
                    {filtered.length !== data.length
                        ? `${filtered.length} of ${data.length} records`
                        : `${data.length} record${data.length !== 1 ? 's' : ''}`}
                </div>
            )}
        </div>
    );
}
