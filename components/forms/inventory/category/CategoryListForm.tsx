'use client';

import PopUpDeleteTransactionModal from '@/components/ui/PopUpDeleteModal';
import { usePageActions } from '@/hook/usePageAction';
import type { TMeta } from '@/types/app';
import type { TCategory } from '@/types/inventory/item';
import { resolveHref } from '@/utils/utils';
import { ChevronLeft, ChevronRight, LayoutList, Search } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useState, useTransition } from 'react';

export default function CategoryListForm({
    categories,
    meta,
}: {
    categories: Array<TCategory & { id: number }>;
    meta: TMeta;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();

    const pageAction = usePageActions();
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [toast, setToast] = useState<{
        msg: string;
        type: 'success' | 'error';
    } | null>(null);

    const staticActions = pageAction?.actions.filter((a) => !a.dynamic) ?? [];
    const dynamicActions = pageAction?.actions.filter((a) => a.dynamic) ?? [];

    // ── URL helpers ──────────────────────────────────────────────────────────
    const createQueryString = useCallback(
        (updates: Record<string, string>) => {
            const params = new URLSearchParams(searchParams.toString());
            Object.entries(updates).forEach(([key, value]) => {
                if (value) params.set(key, value);
                else params.delete(key);
            });
            return params.toString();
        },
        [searchParams],
    );

    const navigate = (updates: Record<string, string>) => {
        startTransition(() => {
            router.push(`${pathname}?${createQueryString(updates)}`);
        });
    };

    // ── Search ───────────────────────────────────────────────────────────────
    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        navigate({ search: e.target.value, page: '1' });
    };

    // ── Pagination ───────────────────────────────────────────────────────────
    const handlePageChange = (newPage: number) => {
        navigate({ page: String(newPage) });
    };

    const handleLimitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        navigate({ limit: e.target.value, page: '1' });
    };

    const currentPage = meta.page;
    const totalPages = meta.totalPages;

    const getPageNumbers = () => {
        const delta = 2;
        const range: (number | '...')[] = [];
        const left = Math.max(1, currentPage - delta);
        const right = Math.min(totalPages, currentPage + delta);

        if (left > 1) {
            range.push(1);
            if (left > 2) range.push('...');
        }
        for (let i = left; i <= right; i++) range.push(i);
        if (right < totalPages) {
            if (right < totalPages - 1) range.push('...');
            range.push(totalPages);
        }
        return range;
    };

    // ── Delete ───────────────────────────────────────────────────────────────
    const onConfirm = async () => {
        if (!deletingId) return;
        try {
            setIsDeleting(true);
            const res = await fetch(
                `/api/inventory/configurations/category/${deletingId}`,
                { method: 'DELETE' },
            );
            if (!res.ok) throw new Error('Delete failed');
            setToast({ msg: 'Delete successful', type: 'success' });
            router.refresh();
        } catch {
            setToast({ msg: 'Delete failed', type: 'error' });
        } finally {
            setIsDeleting(false);
            setDeletingId(null);
        }
    };

    return (
        <main>
            {/* Toast */}
            {toast && (
                <div
                    className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-lg transition-all ${
                        toast.type === 'success'
                            ? 'bg-emerald-500 text-white'
                            : 'bg-rose-500 text-white'
                    }`}
                >
                    {toast.msg}
                </div>
            )}

            <PopUpDeleteTransactionModal
                open={!!deletingId}
                loading={isDeleting}
                onClose={() => setDeletingId(null)}
                onConfirm={onConfirm}
            />

            <div className="max-w-full mx-auto space-y-6 animate-in fade-in duration-500 p-4 md:p-8">
                {/* ── Page header ── */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                            <LayoutList className="text-emerald-600" />
                            Category
                        </h2>
                        <p className="text-slate-500 text-sm mt-1">
                            គ្រប់គ្រងប្រភេទទំនិញ
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        {staticActions.map((action) => {
                            const Icon = action.icon;
                            return (
                                <Link
                                    key={action.label}
                                    href={action.href as string}
                                    className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium shadow-sm transition-colors"
                                >
                                    {Icon && <Icon size={16} />}
                                    {action.label}
                                </Link>
                            );
                        })}
                    </div>
                </div>

                {/* ── Search + limit ── */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <div className="relative max-w-md w-full">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search size={16} className="text-slate-400" />
                        </div>
                        <input
                            type="text"
                            defaultValue={searchParams.get('search') ?? ''}
                            onChange={handleSearch}
                            placeholder="ស្វែងរកតាមឈ្មោះ ឬលេខកូដ"
                            className="block w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                        />
                    </div>

                    {/* Rows per page */}
                    <div className="flex items-center gap-2 text-sm text-slate-500 shrink-0">
                        <span>Rows</span>
                        <select
                            defaultValue={searchParams.get('limit') ?? '10'}
                            onChange={handleLimitChange}
                            className="border border-slate-200 rounded-lg px-2 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                        >
                            {[10, 20, 50, 100].map((n) => (
                                <option key={n} value={n}>
                                    {n}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* ── Table ── */}
                <div
                    className={`bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden transition-opacity duration-200 ${isPending ? 'opacity-60 pointer-events-none' : ''}`}
                >
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-100">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                        Reference
                                    </th>
                                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                        Name
                                    </th>
                                    <th className="px-6 py-3.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>

                            <tbody className="bg-white divide-y divide-slate-100">
                                {categories.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={3}
                                            className="text-center py-12 text-slate-400 text-sm"
                                        >
                                            មិនមានទិន្នន័យ
                                        </td>
                                    </tr>
                                ) : (
                                    categories.map((item) => (
                                        <tr
                                            key={item.id}
                                            className="hover:bg-slate-50/70 transition-colors"
                                        >
                                            <td className="px-6 py-4 whitespace-nowrap text-xs font-medium text-slate-500">
                                                {item.reference_no ?? '—'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-800">
                                                {item.name}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                                <div className="inline-flex items-center gap-2 justify-end">
                                                    {dynamicActions.map(
                                                        (action) => {
                                                            const Icon =
                                                                action.icon;
                                                            const href =
                                                                resolveHref(
                                                                    action.href as string,
                                                                    item.id,
                                                                );

                                                            if (
                                                                action.label.toLowerCase() ===
                                                                'delete'
                                                            ) {
                                                                return (
                                                                    <button
                                                                        key={
                                                                            action.label
                                                                        }
                                                                        type="button"
                                                                        onClick={() =>
                                                                            setDeletingId(
                                                                                item.id,
                                                                            )
                                                                        }
                                                                        disabled={
                                                                            deletingId ===
                                                                            item.id
                                                                        }
                                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors disabled:opacity-40"
                                                                    >
                                                                        {Icon && (
                                                                            <Icon
                                                                                size={
                                                                                    13
                                                                                }
                                                                            />
                                                                        )}
                                                                        {
                                                                            action.label
                                                                        }
                                                                    </button>
                                                                );
                                                            }

                                                            return (
                                                                <Link
                                                                    key={
                                                                        action.label
                                                                    }
                                                                    href={href}
                                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-sky-600 hover:bg-sky-50 border border-sky-200 transition-colors"
                                                                >
                                                                    {Icon && (
                                                                        <Icon
                                                                            size={
                                                                                13
                                                                            }
                                                                        />
                                                                    )}
                                                                    {
                                                                        action.label
                                                                    }
                                                                </Link>
                                                            );
                                                        },
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* ── Pagination footer ── */}
                    {totalPages > 0 && (
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
                            {/* Summary */}
                            <p className="text-xs text-slate-500 shrink-0">
                                Showing{' '}
                                <span className="font-semibold text-slate-700">
                                    {(currentPage - 1) * meta.limit + 1}
                                </span>
                                {' – '}
                                <span className="font-semibold text-slate-700">
                                    {Math.min(
                                        currentPage * meta.limit,
                                        meta.total,
                                    )}
                                </span>{' '}
                                of{' '}
                                <span className="font-semibold text-slate-700">
                                    {meta.total}
                                </span>{' '}
                                results
                            </p>

                            {/* Page buttons */}
                            <div className="flex items-center gap-1">
                                {/* Prev */}
                                <button
                                    onClick={() =>
                                        handlePageChange(currentPage - 1)
                                    }
                                    disabled={currentPage <= 1 || isPending}
                                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-white hover:text-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                    aria-label="Previous page"
                                >
                                    <ChevronLeft size={15} />
                                </button>

                                {getPageNumbers().map((p, i) =>
                                    p === '...' ? (
                                        <span
                                            key={`ellipsis-${i}`}
                                            className="px-1 text-slate-400 text-sm select-none"
                                        >
                                            …
                                        </span>
                                    ) : (
                                        <button
                                            key={p}
                                            onClick={() =>
                                                handlePageChange(p as number)
                                            }
                                            disabled={isPending}
                                            className={`min-w-8 h-8 px-2 rounded-lg text-xs font-medium border transition-colors disabled:cursor-not-allowed ${
                                                p === currentPage
                                                    ? 'bg-emerald-600 border-emerald-600 text-white'
                                                    : 'border-slate-200 text-slate-600 hover:bg-white hover:text-slate-800'
                                            }`}
                                        >
                                            {p}
                                        </button>
                                    ),
                                )}

                                {/* Next */}
                                <button
                                    onClick={() =>
                                        handlePageChange(currentPage + 1)
                                    }
                                    disabled={
                                        currentPage >= totalPages || isPending
                                    }
                                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-white hover:text-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                    aria-label="Next page"
                                >
                                    <ChevronRight size={15} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}
