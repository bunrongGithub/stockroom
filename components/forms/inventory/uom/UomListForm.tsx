'use client';

import { usePageActions } from '@/hook/usePageAction';
import { DateTimeFormat } from '@/lib/utils/dateformat';
import { resolveHref } from '@/utils/utils';
import { LayoutList, Package, Search } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

type TUomProp = {
    id: number;
    name: string;
    reference_no: string | null;
    writed_at: string | null;
    created_at: string | null;
};

export default function UomListForm({ uoms }: { uoms: Array<TUomProp> }) {
    const pageAction = usePageActions();
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [toast, setToast] = useState<{
        msg: string;
        type: 'success' | 'error';
    } | null>(null);

    // ─── Derive action slices from dataset ────────────────────────────────────
    // static: dynamic === false  → used in the page header (no id needed)
    // dynamic: dynamic === true  → used per row (id injected at render time)
    const staticActions = pageAction?.actions.filter((a) => !a.dynamic) ?? [];
    const dynamicActions = pageAction?.actions.filter((a) => a.dynamic) ?? [];

    function showToast(msg: string, type: 'success' | 'error') {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    }

    // ─── Render ───────────────────────────────────────────────────────────────
    return (
        <main>
            {/* Toast */}
            {toast && (
                <div
                    className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-lg transition-all
                        ${
                            toast.type === 'success'
                                ? 'bg-emerald-500 text-white'
                                : 'bg-rose-500 text-white'
                        }`}
                >
                    {toast.msg}
                </div>
            )}

            <div className="max-w-full mx-auto space-y-6 animate-in fade-in duration-500 p-4 md:p-8">
                {/* ── Page header ── */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                            <Package className="text-emerald-600" />
                            UOM
                        </h2>
                        <p className="text-slate-500 text-sm mt-1">
                            គ្រប់គ្រងខ្នាតទំនិញ
                        </p>
                    </div>

                    {/* Static actions (e.g. Create) — no id required */}
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

                {/* ── Search ── */}
                <div className="relative max-w-md">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search size={16} className="text-slate-400" />
                    </div>
                    <input
                        type="text"
                        placeholder="ស្វែងរកតាមឈ្មោះ ឬលេខកូដ"
                        className="block w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    />
                </div>

                {/* ── Table ── */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto min-h-64">
                        <table className="min-w-full divide-slate-100">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                        Reference
                                    </th>
                                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                        Name
                                    </th>
                                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                        Created At
                                    </th>
                                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                        Updated At
                                    </th>
                                    <th className="px-6 py-3.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>

                            <tbody className="bg-white divide-slate-100">
                                {uoms.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={3}
                                            className="text-center py-12 text-slate-400 text-sm"
                                        >
                                            មិនមានទិន្នន័យ
                                        </td>
                                    </tr>
                                ) : (
                                    uoms.map((item) => (
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
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-800">
                                                {DateTimeFormat(
                                                    item.created_at as string,
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-800">
                                                {DateTimeFormat(
                                                    item.writed_at as string,
                                                )}
                                            </td>
                                            {/* ── Dynamic actions per row ── */}
                                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                                <div className="inline-flex items-center gap-2 justify-end">
                                                    {dynamicActions.map(
                                                        (action) => {
                                                            const Icon =
                                                                action.icon;

                                                            // Resolve href: replace ':id' with the
                                                            // actual row id from the dataset template
                                                            const href =
                                                                resolveHref(
                                                                    action.href as string,
                                                                    item.id,
                                                                );

                                                            // Delete has no href navigation —
                                                            // identified by label, fires handler
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
                                                                        // onClick={() =>
                                                                        //     handleDelete(
                                                                        //         item.id,
                                                                        //     )
                                                                        // }
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
                                                                        {deletingId ===
                                                                        item.id
                                                                            ? 'កំពុងលុប...'
                                                                            : action.label}
                                                                    </button>
                                                                );
                                                            }

                                                            // All other dynamic actions → Link
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
                </div>
            </div>
        </main>
    );
}
