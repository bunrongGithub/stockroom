'use client';

import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { useRegisterModule } from '@/hook/useModule';
import type { ModuleProps } from '@/lib/registry';
import { saleOrderApi } from '@/lib/api/sale';
import type { SalesOrder, SalesOrderStatus } from '@/types/sales/order-management';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    PlusIcon,
    EyeIcon,
    PencilIcon,
    TruckIcon,
    XCircleIcon,
    CheckCircleIcon,
    Loader2Icon,
} from 'lucide-react';

function StatusBadge({ status }: { status: SalesOrderStatus }) {
    const map: Record<SalesOrderStatus, string> = {
        open: 'bg-emerald-100 text-emerald-800',
        partial_shipment: 'bg-amber-100 text-amber-800',
        closed: 'bg-sky-100 text-sky-800',
        cancelled: 'bg-rose-100 text-rose-800',
    };
    const labels: Record<SalesOrderStatus, string> = {
        open: 'Open',
        partial_shipment: 'Partial Shipment',
        closed: 'Closed',
        cancelled: 'Cancelled',
    };
    return (
        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-mono font-medium ${map[status]}`}>
            {labels[status]}
        </span>
    );
}

function fmt(n: number) {
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function SaleOrderPage({ currentPath, permission, currentPathActions }: ModuleProps) {
    useRegisterModule({ actionModules: currentPathActions, permission, modulePath: currentPath.path });

    const router = useRouter();
    const [orders, setOrders] = useState<SalesOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
    const [confirmAction, setConfirmAction] = useState<{ type: 'cancel' | 'close'; id: number; no: string } | null>(null);
    const [busy, setBusy] = useState(false);

    function showToast(msg: string, type: 'success' | 'error') {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    }

    async function refresh() {
        setLoading(true);
        try {
            setOrders(await saleOrderApi.list());
        } catch (e) {
            showToast(e instanceof Error ? e.message : 'Failed to load orders', 'error');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        refresh();
    }, []);

    async function runAction(type: 'cancel' | 'close', id: number) {
        setBusy(true);
        try {
            if (type === 'cancel') await saleOrderApi.cancel(id);
            else await saleOrderApi.close(id);
            showToast(`Sales order ${type === 'cancel' ? 'cancelled' : 'closed'}.`, 'success');
            await refresh();
        } catch (e) {
            showToast(e instanceof Error ? e.message : `Cannot ${type} order`, 'error');
        } finally {
            setBusy(false);
            setConfirmAction(null);
        }
    }

    const columns: DataTableColumn<SalesOrder>[] = [
        {
            key: 'order_no',
            header: 'Order No',
            cell: (row) => (
                <button
                    onClick={() => router.push(`/sale/order/${row.id}/view`)}
                    className="font-mono text-xs font-semibold text-sky-600 hover:underline"
                >
                    {row.order_no}
                </button>
            ),
        },
        { key: 'customer', header: 'Customer', cell: (row) => <span className="font-mono text-xs">{row.customer_name}</span> },
        { key: 'order_date', header: 'Order Date', cell: (row) => <span className="font-mono text-xs">{row.order_date}</span> },
        { key: 'expected_delivery', header: 'Expected Delivery', cell: (row) => <span className="font-mono text-xs">{row.expected_delivery_date ?? '—'}</span> },
        {
            key: 'grand_total',
            header: 'Grand Total',
            cell: (row) => <span className="font-mono text-xs font-semibold">{row.currency} {fmt(row.grand_total)}</span>,
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
                            onClick={() => router.push(`/sale/order/${row.id}/view`)}
                            className="inline-flex items-center gap-1 rounded-lg border border-sky-200 px-2 py-1 text-xs text-sky-600 hover:bg-sky-50 font-mono"
                        >
                            <EyeIcon size={11} /> View
                        </button>
                        {a?.can_update && (
                            <button
                                onClick={() => router.push(`/sale/order/${row.id}/update`)}
                                className="inline-flex items-center gap-1 rounded-lg border border-violet-200 px-2 py-1 text-xs text-violet-600 hover:bg-violet-50 font-mono"
                            >
                                <PencilIcon size={11} /> Edit
                            </button>
                        )}
                        {a?.can_ship && (
                            <button
                                onClick={() => {
                                    if (typeof window !== 'undefined') sessionStorage.setItem('pending_dn_order_id', String(row.id));
                                    router.push('/sale/delivery-note/create');
                                }}
                                className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 px-2 py-1 text-xs text-emerald-600 hover:bg-emerald-50 font-mono"
                            >
                                <TruckIcon size={11} /> Ship
                            </button>
                        )}
                        {a?.can_close && (
                            <button
                                onClick={() => setConfirmAction({ type: 'close', id: row.id, no: row.order_no })}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 font-mono"
                            >
                                <CheckCircleIcon size={11} /> Close
                            </button>
                        )}
                        {a?.can_cancel && (
                            <button
                                onClick={() => setConfirmAction({ type: 'cancel', id: row.id, no: row.order_no })}
                                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 font-mono"
                            >
                                <XCircleIcon size={11} /> Cancel
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
                <div className={`fixed right-4 top-4 z-50 rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
                    {toast.msg}
                </div>
            )}

            {confirmAction && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
                    <div className="rounded-2xl bg-white p-6 shadow-xl w-80 space-y-4">
                        <h3 className="font-semibold text-sm">{confirmAction.type === 'cancel' ? 'Cancel Order' : 'Close Order'}</h3>
                        <p className="text-xs text-muted-foreground">
                            {confirmAction.type === 'cancel'
                                ? `Cancel ${confirmAction.no}? Orders with posted shipments cannot be cancelled.`
                                : `Mark ${confirmAction.no} as closed? No further shipments will be allowed.`}
                        </p>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setConfirmAction(null)} className="rounded-lg border px-3 py-1.5 text-xs hover:bg-muted font-mono">Cancel</button>
                            <button
                                disabled={busy}
                                onClick={() => runAction(confirmAction.type, confirmAction.id)}
                                className={`rounded-lg px-3 py-1.5 text-xs text-white font-mono disabled:opacity-60 ${confirmAction.type === 'cancel' ? 'bg-rose-500 hover:bg-rose-600' : 'bg-slate-600 hover:bg-slate-700'}`}
                            >
                                {busy ? 'Working…' : 'Confirm'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Sales Orders</h1>
                    <p className="text-xs text-muted-foreground mt-0.5">Manage customer orders and shipments</p>
                </div>
                <button
                    onClick={() => router.push('/sale/order/create')}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-500 font-mono shadow-sm"
                >
                    <PlusIcon size={15} /> New Order
                </button>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <Loader2Icon className="animate-spin text-emerald-500" size={26} />
                </div>
            ) : (
                <DataTable<SalesOrder>
                    columns={columns}
                    data={orders}
                    keyExtractor={(row) => row.id}
                    searchFn={(row, q) =>
                        row.order_no.toLowerCase().includes(q) ||
                        row.customer_name.toLowerCase().includes(q) ||
                        row.status.toLowerCase().includes(q)
                    }
                    searchPlaceholder="Search by order no, customer, or status..."
                    pageSize={10}
                    emptyTitle="No sales orders"
                    emptyDescription="Create your first sales order to get started"
                />
            )}
        </main>
    );
}
