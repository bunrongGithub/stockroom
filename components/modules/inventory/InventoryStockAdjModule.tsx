'use client';

import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { useRegisterModule } from '@/hook/useModule';
import type { ModuleProps } from '@/lib/registry';
import { stockAdjustmentApi } from '@/lib/api/adjustment';
import type {
    StockAdjustment,
    StockAdjustmentStatus,
} from '@/types/inventory/adjustment';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    ArrowLeftRight,
    Ban,
    EyeIcon,
    Loader2Icon,
    PencilIcon,
    PlusIcon,
    SendIcon,
    Trash2Icon,
} from 'lucide-react';

function StatusBadge({ status }: { status: StockAdjustmentStatus }) {
    const map: Record<StockAdjustmentStatus, string> = {
        DRAFT: 'bg-gray-100 text-gray-600',
        POSTED: 'bg-emerald-100 text-emerald-800',
        VOID: 'bg-rose-100 text-rose-800',
    };
    return (
        <span
            className={`inline-block rounded-full px-2 py-0.5 text-xs font-mono font-medium ${map[status]}`}
        >
            {status}
        </span>
    );
}

export default function InventoryStockAdjModule({
    currentPath,
    permission,
    currentPathActions,
}: ModuleProps) {
    useRegisterModule({
        actionModules: currentPathActions,
        permission,
        modulePath: currentPath.path,
    });

    const router = useRouter();
    const [adjustments, setAdjustments] = useState<StockAdjustment[]>([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(
        null,
    );
    const [confirm, setConfirm] = useState<{
        type: 'post' | 'void' | 'delete';
        id: number;
        no: string;
    } | null>(null);
    const [busy, setBusy] = useState(false);

    function showToast(msg: string, type: 'success' | 'error') {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 4000);
    }

    async function refresh() {
        setLoading(true);
        try {
            setAdjustments(await stockAdjustmentApi.list());
        } catch (e) {
            showToast(
                e instanceof Error ? e.message : 'Failed to load adjustments',
                'error',
            );
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        refresh();
    }, []);

    async function runAction() {
        if (!confirm) return;
        setBusy(true);
        try {
            if (confirm.type === 'post') await stockAdjustmentApi.post(confirm.id);
            else if (confirm.type === 'void') await stockAdjustmentApi.void(confirm.id);
            else await stockAdjustmentApi.remove(confirm.id);
            showToast(
                confirm.type === 'post'
                    ? 'Adjustment posted — inventory updated.'
                    : confirm.type === 'void'
                      ? 'Adjustment voided.'
                      : 'Adjustment deleted.',
                'success',
            );
            await refresh();
        } catch (e) {
            showToast(
                e instanceof Error ? e.message : `Cannot ${confirm.type} adjustment`,
                'error',
            );
        } finally {
            setBusy(false);
            setConfirm(null);
        }
    }

    const columns: DataTableColumn<StockAdjustment>[] = [
        {
            key: 'adjustment_no',
            header: 'Adjustment No',
            cell: (row) => (
                <button
                    onClick={() => router.push(`/inventory/stock_adjust/${row.id}/view`)}
                    className="font-mono text-xs font-semibold text-sky-600 hover:underline"
                >
                    {row.adjustment_no}
                </button>
            ),
        },
        {
            key: 'date',
            header: 'Date',
            cell: (row) => <span className="font-mono text-xs">{row.adjustment_date}</span>,
        },
        {
            key: 'warehouse',
            header: 'Warehouse / Location',
            cell: (row) => (
                <span className="font-mono text-xs">
                    {row.warehouse_name} · {row.location_name}
                </span>
            ),
        },
        {
            key: 'reason',
            header: 'Reason',
            cell: (row) => <span className="font-mono text-xs">{row.reason_label}</span>,
        },
        {
            key: 'qty',
            header: '± Qty',
            cell: (row) => (
                <span className="font-mono text-xs tabular-nums">
                    {row.total_in > 0 && (
                        <span className="text-emerald-600">+{row.total_in}</span>
                    )}
                    {row.total_in > 0 && row.total_out > 0 && ' · '}
                    {row.total_out > 0 && (
                        <span className="text-rose-600">−{row.total_out}</span>
                    )}
                </span>
            ),
        },
        { key: 'status', header: 'Status', cell: (row) => <StatusBadge status={row.status} /> },
        {
            key: 'actions',
            header: 'Actions',
            cell: (row) => {
                const a = row.actions;
                return (
                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={() =>
                                router.push(`/inventory/stock_adjust/${row.id}/view`)
                            }
                            className="inline-flex items-center gap-1 rounded-lg border border-sky-200 px-2 py-1 text-xs text-sky-600 hover:bg-sky-50 font-mono"
                        >
                            <EyeIcon size={11} /> View
                        </button>
                        {a?.can_update && (
                            <button
                                onClick={() =>
                                    router.push(`/inventory/stock_adjust/${row.id}/update`)
                                }
                                className="inline-flex items-center gap-1 rounded-lg border border-violet-200 px-2 py-1 text-xs text-violet-600 hover:bg-violet-50 font-mono"
                            >
                                <PencilIcon size={11} /> Edit
                            </button>
                        )}
                        {a?.can_post && (
                            <button
                                onClick={() =>
                                    setConfirm({ type: 'post', id: row.id, no: row.adjustment_no })
                                }
                                className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 px-2 py-1 text-xs text-emerald-600 hover:bg-emerald-50 font-mono"
                            >
                                <SendIcon size={11} /> Post
                            </button>
                        )}
                        {a?.can_void && (
                            <button
                                onClick={() =>
                                    setConfirm({ type: 'void', id: row.id, no: row.adjustment_no })
                                }
                                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 font-mono"
                            >
                                <Ban size={11} /> Void
                            </button>
                        )}
                        {a?.can_delete && (
                            <button
                                onClick={() =>
                                    setConfirm({
                                        type: 'delete',
                                        id: row.id,
                                        no: row.adjustment_no,
                                    })
                                }
                                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 font-mono"
                            >
                                <Trash2Icon size={11} /> Delete
                            </button>
                        )}
                    </div>
                );
            },
        },
    ];

    return (
        <main className="space-y-4">
            {toast && (
                <div
                    className={`fixed right-4 top-4 z-50 rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${
                        toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
                    }`}
                >
                    {toast.msg}
                </div>
            )}

            {confirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
                    <div className="w-96 space-y-4 rounded-2xl bg-white p-6 shadow-xl">
                        <h3 className="text-sm font-semibold capitalize">
                            {confirm.type} Adjustment
                        </h3>
                        <p className="text-xs text-muted-foreground">
                            {confirm.type === 'post'
                                ? `Post ${confirm.no}? Inventory movements are created, stock balances update, and the document becomes read-only.`
                                : confirm.type === 'void'
                                  ? `Void draft ${confirm.no}? It is kept for audit but can no longer be posted.`
                                  : `Delete draft ${confirm.no}?`}
                        </p>
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setConfirm(null)}
                                className="rounded-lg border px-3 py-1.5 text-xs hover:bg-muted font-mono"
                            >
                                Back
                            </button>
                            <button
                                disabled={busy}
                                onClick={runAction}
                                className={`rounded-lg px-3 py-1.5 text-xs text-white font-mono disabled:opacity-60 ${
                                    confirm.type === 'post'
                                        ? 'bg-emerald-600 hover:bg-emerald-700'
                                        : 'bg-rose-500 hover:bg-rose-600'
                                }`}
                            >
                                {busy ? 'Working…' : 'Confirm'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex items-center justify-between">
                <div>
                    <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
                        <ArrowLeftRight size={20} className="text-emerald-500" />
                        Stock Adjustments
                    </h1>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        Correct inventory discrepancies through the movement ledger
                    </p>
                </div>
                {permission?.can_create && (
                    <button
                        onClick={() => router.push('/inventory/stock_adjust/create')}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-500 font-mono shadow-sm"
                    >
                        <PlusIcon size={15} /> New Adjustment
                    </button>
                )}
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <Loader2Icon className="animate-spin text-emerald-500" size={26} />
                </div>
            ) : (
                <DataTable<StockAdjustment>
                    columns={columns}
                    data={adjustments}
                    keyExtractor={(row) => row.id}
                    searchFn={(row, q) =>
                        row.adjustment_no.toLowerCase().includes(q) ||
                        (row.reference_no ?? '').toLowerCase().includes(q) ||
                        row.reason_label.toLowerCase().includes(q) ||
                        row.status.toLowerCase().includes(q)
                    }
                    searchPlaceholder="Search by adjustment no, reference, reason, or status..."
                    pageSize={10}
                    emptyTitle="No stock adjustments"
                    emptyDescription="Record an adjustment to correct inventory discrepancies"
                />
            )}
        </main>
    );
}
