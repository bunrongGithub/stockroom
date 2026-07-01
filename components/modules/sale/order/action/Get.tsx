'use client';

import { useRegisterModule } from '@/hook/useModule';
import type { ModuleProps } from '@/lib/registry';
import { saleOrderApi, saleShipmentApi } from '@/lib/api/sale';
import type {
    SalesOrder,
    SalesOrderStatus,
    SalesShipment,
    SalesShipmentStatus,
} from '@/types/sales/order-management';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    ArrowLeftIcon,
    PencilIcon,
    TruckIcon,
    XCircleIcon,
    CheckCircleIcon,
    Loader2Icon,
    PackageIcon,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function StatusBadge({ status }: { status: SalesOrderStatus }) {
    const map: Record<SalesOrderStatus, string> = {
        open: 'bg-emerald-100 text-emerald-700',
        partial_shipment: 'bg-amber-100 text-amber-700',
        closed: 'bg-sky-100 text-sky-700',
        cancelled: 'bg-rose-100 text-rose-700',
    };
    const labels: Record<SalesOrderStatus, string> = {
        open: 'Open',
        partial_shipment: 'Partial Shipment',
        closed: 'Closed',
        cancelled: 'Cancelled',
    };
    return <span className={`inline-block rounded-full px-3 py-1 text-xs font-mono font-semibold ${map[status]}`}>{labels[status]}</span>;
}

function ShipmentStatusBadge({ status }: { status: SalesShipmentStatus }) {
    const map: Record<SalesShipmentStatus, string> = {
        DRAFT: 'bg-gray-100 text-gray-600',
        POSTED: 'bg-emerald-100 text-emerald-700',
        VOID: 'bg-rose-100 text-rose-700',
    };
    return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-mono ${map[status]}`}>{status}</span>;
}

function fmt(n: number) {
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function SaleOrderDetail({ currentPath, permission, currentPathActions }: ModuleProps) {
    useRegisterModule({ actionModules: currentPathActions, permission, modulePath: currentPath.path });

    const router = useRouter();
    const params = useParams();
    const id = Array.isArray(params.slug) ? (params.slug.at(-2) ?? '') : '';

    const [order, setOrder] = useState<SalesOrder | null>(null);
    const [shipments, setShipments] = useState<SalesShipment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
    const [confirmAction, setConfirmAction] = useState<'cancel' | 'close' | null>(null);
    const [busy, setBusy] = useState(false);

    function showToast(msg: string, type: 'success' | 'error') {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    }

    async function load() {
        setLoading(true);
        try {
            const o = await saleOrderApi.get(id);
            setOrder(o);
            setShipments(await saleShipmentApi.byOrder(o.id));
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load order');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (id) load();
    }, [id]);

    async function runAction(type: 'cancel' | 'close') {
        if (!order) return;
        setBusy(true);
        try {
            if (type === 'cancel') await saleOrderApi.cancel(order.id);
            else await saleOrderApi.close(order.id);
            showToast(`Order ${type === 'cancel' ? 'cancelled' : 'closed'}.`, 'success');
            await load();
        } catch (e) {
            showToast(e instanceof Error ? e.message : `Cannot ${type} order`, 'error');
        } finally {
            setBusy(false);
            setConfirmAction(null);
        }
    }

    if (loading) {
        return <div className="flex items-center justify-center h-64"><Loader2Icon className="animate-spin text-emerald-500" size={28} /></div>;
    }

    if (error || !order) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
                <PackageIcon className="text-muted-foreground" size={40} />
                <p className="text-sm text-muted-foreground">{error || 'Sales order not found.'}</p>
                <button onClick={() => router.push('/sale/order')} className="text-xs text-sky-600 hover:underline">Back to list</button>
            </div>
        );
    }

    const a = order.actions;

    return (
        <div className="space-y-5">
            {toast && <div className={`fixed right-4 top-4 z-50 rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>{toast.msg}</div>}

            {confirmAction && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
                    <div className="rounded-2xl bg-white p-6 shadow-xl w-80 space-y-4">
                        <h3 className="font-semibold text-sm">{confirmAction === 'cancel' ? 'Cancel Order' : 'Close Order'}</h3>
                        <p className="text-xs text-muted-foreground">
                            {confirmAction === 'cancel' ? 'Orders with posted shipments cannot be cancelled.' : 'Closing prevents further shipments.'}
                        </p>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setConfirmAction(null)} className="rounded-lg border px-3 py-1.5 text-xs hover:bg-muted font-mono">Back</button>
                            <button disabled={busy} onClick={() => runAction(confirmAction)} className={`rounded-lg px-3 py-1.5 text-xs text-white font-mono disabled:opacity-60 ${confirmAction === 'cancel' ? 'bg-rose-500 hover:bg-rose-600' : 'bg-slate-600 hover:bg-slate-700'}`}>
                                {busy ? 'Working…' : 'Confirm'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex items-start justify-between">
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold tracking-tight">{order.order_no}</h1>
                        <StatusBadge status={order.status} />
                    </div>
                    <p className="text-xs text-muted-foreground">Sales Order • {order.customer_name}</p>
                </div>
                <div className="flex items-center gap-2">
                    {a?.can_update && (
                        <button onClick={() => router.push(`/sale/order/${order.id}/update`)} className="inline-flex items-center gap-1.5 rounded-xl border border-violet-200 px-3 py-2 text-xs text-violet-600 hover:bg-violet-50 font-mono">
                            <PencilIcon size={13} /> Edit
                        </button>
                    )}
                    {a?.can_ship && (
                        <button
                            onClick={() => {
                                if (typeof window !== 'undefined') sessionStorage.setItem('pending_dn_order_id', String(order.id));
                                router.push('/sale/delivery-note/create');
                            }}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 px-3 py-2 text-xs text-emerald-600 hover:bg-emerald-50 font-mono"
                        >
                            <TruckIcon size={13} /> Create Shipment
                        </button>
                    )}
                    {a?.can_close && (
                        <button onClick={() => setConfirmAction('close')} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 font-mono">
                            <CheckCircleIcon size={13} /> Close
                        </button>
                    )}
                    {a?.can_cancel && (
                        <button onClick={() => setConfirmAction('cancel')} className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 font-mono">
                            <XCircleIcon size={13} /> Cancel
                        </button>
                    )}
                    <button onClick={() => router.push('/sale/order')} className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs hover:bg-muted font-mono">
                        <ArrowLeftIcon size={13} /> Back
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <Card className="border-none shadow-sm">
                    <CardHeader className="pb-2 pt-4 px-4"><CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Order Info</CardTitle></CardHeader>
                    <CardContent className="px-4 pb-4 grid grid-cols-2 gap-y-3 text-xs font-mono">
                        <span className="text-muted-foreground">Customer</span><span className="font-medium">{order.customer_name}</span>
                        <span className="text-muted-foreground">Phone</span><span>{order.customer_phone || '—'}</span>
                        <span className="text-muted-foreground">Order Date</span><span>{order.order_date}</span>
                        <span className="text-muted-foreground">Expected Delivery</span><span>{order.expected_delivery_date || '—'}</span>
                        <span className="text-muted-foreground">Warehouse</span><span>{order.warehouse_name}</span>
                        <span className="text-muted-foreground">Currency</span><span>{order.currency}</span>
                        {order.notes && (<><span className="text-muted-foreground">Notes</span><span>{order.notes}</span></>)}
                    </CardContent>
                </Card>

                <Card className="border-none shadow-sm">
                    <CardHeader className="pb-2 pt-4 px-4"><CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Financials</CardTitle></CardHeader>
                    <CardContent className="px-4 pb-4 space-y-2 text-xs font-mono">
                        <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{fmt(order.subtotal)}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span className="text-rose-500">- {fmt(order.discount_total)}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span>{fmt(order.tax_total)}</span></div>
                        <div className="flex justify-between border-t pt-2 font-semibold text-sm"><span>Grand Total</span><span>{order.currency} {fmt(order.grand_total)}</span></div>
                    </CardContent>
                </Card>
            </div>

            <Card className="border-none shadow-sm">
                <CardHeader className="pb-2 pt-4 px-4"><CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Order Items</CardTitle></CardHeader>
                <CardContent className="px-4 pb-4">
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs font-mono">
                            <thead>
                                <tr className="border-b text-muted-foreground">
                                    <th className="text-left py-2 pr-3 font-medium">Product</th>
                                    <th className="text-right py-2 pr-3 font-medium">Ordered</th>
                                    <th className="text-right py-2 pr-3 font-medium">Shipped</th>
                                    <th className="text-right py-2 pr-3 font-medium">Remaining</th>
                                    <th className="text-left py-2 pr-3 font-medium">UOM</th>
                                    <th className="text-right py-2 pr-3 font-medium">Unit Price</th>
                                    <th className="text-right py-2 pr-3 font-medium">Disc %</th>
                                    <th className="text-right py-2 pr-3 font-medium">Tax %</th>
                                    <th className="text-right py-2 font-medium">Line Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {order.items.map((item) => {
                                    const remaining = item.ordered_qty - item.shipped_qty;
                                    return (
                                        <tr key={item.id} className="border-b hover:bg-muted/20">
                                            <td className="py-2 pr-3 font-medium">{item.product_name}</td>
                                            <td className="py-2 pr-3 text-right">{item.ordered_qty}</td>
                                            <td className="py-2 pr-3 text-right text-emerald-600 font-medium">{item.shipped_qty}</td>
                                            <td className="py-2 pr-3 text-right"><span className={remaining === 0 ? 'text-slate-400' : 'text-amber-600 font-medium'}>{remaining}</span></td>
                                            <td className="py-2 pr-3">{item.uom || '—'}</td>
                                            <td className="py-2 pr-3 text-right">{fmt(item.unit_price)}</td>
                                            <td className="py-2 pr-3 text-right">{item.discount}%</td>
                                            <td className="py-2 pr-3 text-right">{item.tax}%</td>
                                            <td className="py-2 text-right font-semibold">{fmt(item.line_total)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {shipments.length > 0 && (
                <Card className="border-none shadow-sm">
                    <CardHeader className="pb-2 pt-4 px-4"><CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Shipments ({shipments.length})</CardTitle></CardHeader>
                    <CardContent className="px-4 pb-4">
                        <table className="w-full text-xs font-mono">
                            <thead>
                                <tr className="border-b text-muted-foreground">
                                    <th className="text-left py-2 pr-3 font-medium">Shipment No</th>
                                    <th className="text-left py-2 pr-3 font-medium">Delivery Date</th>
                                    <th className="text-left py-2 pr-3 font-medium">Receiver</th>
                                    <th className="text-left py-2 pr-3 font-medium">Status</th>
                                    <th className="py-2 font-medium">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {shipments.map((s) => (
                                    <tr key={s.id} className="border-b hover:bg-muted/20">
                                        <td className="py-2 pr-3 font-semibold text-sky-600">
                                            <button onClick={() => router.push(`/sale/delivery-note/${s.id}/view`)} className="hover:underline">{s.shipment_no}</button>
                                        </td>
                                        <td className="py-2 pr-3">{s.delivery_date}</td>
                                        <td className="py-2 pr-3">{s.receiver_name || '—'}</td>
                                        <td className="py-2 pr-3"><ShipmentStatusBadge status={s.status} /></td>
                                        <td className="py-2">
                                            <button onClick={() => router.push(`/sale/delivery-note/${s.id}/view`)} className="text-sky-500 hover:underline text-xs">View</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </CardContent>
                </Card>
            )}

            <div className="text-xs text-muted-foreground font-mono">Last updated {new Date(order.updated_at).toLocaleString()}</div>
        </div>
    );
}
