'use client';

import { useRegisterModule } from '@/hook/useModule';
import type { ModuleProps } from '@/lib/registry';
import { stockAdjustmentApi } from '@/lib/api/adjustment';
import type {
    StockAdjustment,
    StockAdjustmentStatus,
} from '@/types/inventory/adjustment';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    ArrowLeftIcon,
    ArrowLeftRight,
    Ban,
    FileWarning,
    Loader2Icon,
    PencilIcon,
    SendIcon,
} from 'lucide-react';

function StatusBadge({ status }: { status: StockAdjustmentStatus }) {
    const map: Record<StockAdjustmentStatus, string> = {
        DRAFT: 'bg-gray-100 text-gray-600',
        POSTED: 'bg-emerald-100 text-emerald-800',
        VOID: 'bg-rose-100 text-rose-800',
    };
    return (
        <span
            className={`inline-block rounded-full px-2.5 py-1 text-xs font-mono font-medium ${map[status]}`}
        >
            {status}
        </span>
    );
}

// Registered as `InventoryStockAdjDetail`.
export default function InventoryStockAdjDetail({
    currentPath,
    permission,
    currentPathActions,
}: ModuleProps) {
    useRegisterModule({
        actionModules: currentPathActions,
        permission,
        modulePath: currentPath.path,
    });

    const params = useParams();
    const router = useRouter();
    const id = Number(Array.isArray(params.slug) ? params.slug.at(-2) : '');

    const [adjustment, setAdjustment] = useState<StockAdjustment | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [actionError, setActionError] = useState('');
    const [confirmPost, setConfirmPost] = useState(false);

    async function load() {
        try {
            setAdjustment(await stockAdjustmentApi.get(id));
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load adjustment');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (id) load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    async function act(kind: 'post' | 'void') {
        setActionError('');
        setBusy(true);
        try {
            if (kind === 'post') await stockAdjustmentApi.post(id);
            else await stockAdjustmentApi.void(id);
            setConfirmPost(false);
            await load();
            router.refresh();
        } catch (e) {
            setActionError(
                e instanceof Error ? e.message : `Cannot ${kind} adjustment`,
            );
            setConfirmPost(false);
        } finally {
            setBusy(false);
        }
    }

    if (loading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loader2Icon className="animate-spin text-emerald-500" size={26} />
            </div>
        );
    }

    if (error || !adjustment) {
        return (
            <div className="flex h-64 flex-col items-center justify-center gap-3">
                <FileWarning className="text-muted-foreground" size={40} />
                <p className="text-sm text-muted-foreground">
                    {error || 'Adjustment not found.'}
                </p>
                <button
                    onClick={() => router.push('/inventory/stock_adjust')}
                    className="text-xs text-sky-600 hover:underline"
                >
                    Back to list
                </button>
            </div>
        );
    }

    const a = adjustment.actions;

    return (
        <div className="space-y-5 font-mono text-xs">
            {/* Post confirmation */}
            {confirmPost && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
                    <div className="w-96 space-y-4 rounded-2xl bg-white p-6 shadow-xl">
                        <h3 className="text-sm font-semibold">Post Adjustment</h3>
                        <p className="text-xs text-muted-foreground">
                            Post {adjustment.adjustment_no}?{' '}
                            <span className="text-emerald-600 font-semibold">
                                +{adjustment.total_in} IN
                            </span>{' '}
                            ·{' '}
                            <span className="text-rose-600 font-semibold">
                                −{adjustment.total_out} OUT
                            </span>
                            <br />
                            Inventory movements are created, stock balances update,
                            serial numbers change status, and the document locks.
                        </p>
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setConfirmPost(false)}
                                className="rounded-lg border px-3 py-1.5 text-xs hover:bg-muted"
                            >
                                Back
                            </button>
                            <button
                                disabled={busy}
                                onClick={() => act('post')}
                                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs text-white hover:bg-emerald-700 disabled:opacity-60"
                            >
                                {busy ? 'Posting…' : 'Confirm Post'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <h1 className="flex items-center gap-2 text-xl font-bold text-slate-800">
                        <ArrowLeftRight size={18} className="text-[#1a9e52]" />
                        {adjustment.adjustment_no}
                    </h1>
                    <StatusBadge status={adjustment.status} />
                </div>
                <div className="flex gap-1.5">
                    {a?.can_update && (
                        <button
                            onClick={() =>
                                router.push(
                                    `/inventory/stock_adjust/${adjustment.id}/update`,
                                )
                            }
                            className="inline-flex items-center gap-1.5 rounded-xl border border-violet-200 px-3 py-2 text-violet-600 hover:bg-violet-50"
                        >
                            <PencilIcon size={13} /> Edit
                        </button>
                    )}
                    {a?.can_post && (
                        <button
                            onClick={() => setConfirmPost(true)}
                            disabled={busy}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-500 disabled:opacity-60"
                        >
                            <SendIcon size={13} /> Post
                        </button>
                    )}
                    {a?.can_void && (
                        <button
                            onClick={() => act('void')}
                            disabled={busy}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                        >
                            {busy ? (
                                <Loader2Icon className="animate-spin" size={13} />
                            ) : (
                                <Ban size={13} />
                            )}
                            Void
                        </button>
                    )}
                    <button
                        onClick={() => router.push('/inventory/stock_adjust')}
                        className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 hover:bg-muted"
                    >
                        <ArrowLeftIcon size={13} /> Back
                    </button>
                </div>
            </div>

            {actionError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700">
                    {actionError}
                </div>
            )}

            {/* Adjustment information */}
            <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                    Adjustment Information
                </h3>
                <div className="grid grid-cols-2 gap-y-3 lg:grid-cols-4">
                    <span className="text-slate-400">Reference No</span>
                    <span>{adjustment.reference_no || '—'}</span>
                    <span className="text-slate-400">Date</span>
                    <span>{adjustment.adjustment_date}</span>
                    <span className="text-slate-400">Warehouse</span>
                    <span className="font-medium">{adjustment.warehouse_name}</span>
                    <span className="text-slate-400">Location</span>
                    <span className="font-medium">{adjustment.location_name}</span>
                    <span className="text-slate-400">Reason</span>
                    <span className="font-medium">{adjustment.reason_label}</span>
                    <span className="text-slate-400">Remarks</span>
                    <span>{adjustment.remarks || '—'}</span>
                    <span className="text-slate-400">Posted At</span>
                    <span>
                        {adjustment.posted_at
                            ? new Date(adjustment.posted_at).toLocaleString()
                            : '—'}
                    </span>
                    <span className="text-slate-400">Totals</span>
                    <span>
                        <span className="text-emerald-600 font-semibold">
                            +{adjustment.total_in}
                        </span>{' '}
                        ·{' '}
                        <span className="text-rose-600 font-semibold">
                            −{adjustment.total_out}
                        </span>
                    </span>
                </div>
            </section>

            {/* Items */}
            <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                    Items ({adjustment.items.length})
                </h3>
                <div className="overflow-x-auto">
                    <table className="w-full tabular-nums">
                        <thead>
                            <tr className="border-b text-[10px] uppercase tracking-wider text-slate-500">
                                <th className="py-2 pr-3 text-left font-bold">Item</th>
                                <th className="py-2 pr-3 text-left font-bold">SKU</th>
                                <th className="py-2 pr-3 text-right font-bold">Current</th>
                                <th className="py-2 pr-3 text-right font-bold">Adjustment</th>
                                <th className="py-2 pr-3 text-right font-bold">New Qty</th>
                                <th className="py-2 pr-3 text-left font-bold">UOM</th>
                                <th className="py-2 pr-3 text-left font-bold">Serial Numbers</th>
                                <th className="py-2 text-left font-bold">Remarks</th>
                            </tr>
                        </thead>
                        <tbody>
                            {adjustment.items.map((item) => (
                                <tr key={item.id} className="border-b align-top last:border-b-0">
                                    <td className="py-2 pr-3 font-medium">
                                        {item.product_name}
                                    </td>
                                    <td className="py-2 pr-3 text-[10px]">{item.sku || '—'}</td>
                                    <td className="py-2 pr-3 text-right text-slate-500">
                                        {item.current_qty}
                                    </td>
                                    <td
                                        className={`py-2 pr-3 text-right font-semibold ${
                                            item.adjustment_qty > 0
                                                ? 'text-emerald-600'
                                                : 'text-rose-600'
                                        }`}
                                    >
                                        {item.adjustment_qty > 0
                                            ? `+${item.adjustment_qty}`
                                            : item.adjustment_qty}
                                    </td>
                                    <td className="py-2 pr-3 text-right font-semibold">
                                        {item.new_qty}
                                    </td>
                                    <td className="py-2 pr-3">{item.uom || '—'}</td>
                                    <td className="py-2 pr-3 text-[10px]">
                                        {item.serial_numbers.length
                                            ? item.serial_numbers.map((sn) => (
                                                  <p key={sn}>{sn}</p>
                                              ))
                                            : '—'}
                                    </td>
                                    <td className="py-2 text-[10px] text-slate-500">
                                        {item.remarks || '—'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}
