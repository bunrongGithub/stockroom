'use client';

import { useRegisterModule } from '@/hook/useModule';
import type { ModuleProps } from '@/lib/registry';
import { getDeliveryNote, confirmDeliveryNote, cancelDeliveryNote } from '@/lib/mock-sales-store';
import type { DeliveryNote, DeliveryNoteStatus } from '@/types/sales/order-management';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeftIcon, CheckCircleIcon, XCircleIcon, Loader2Icon, TruckIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function DNStatusBadge({ status }: { status: DeliveryNoteStatus }) {
    const map: Record<DeliveryNoteStatus, string> = {
        draft: 'bg-gray-100 text-gray-700',
        confirmed: 'bg-emerald-100 text-emerald-700',
        cancelled: 'bg-rose-100 text-rose-700',
    };
    return (
        <span className={`inline-block rounded-full px-3 py-1 text-xs font-mono font-semibold ${map[status]}`}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
    );
}

export default function SaleDeliveryNoteDetail({ currentPath, permission, currentPathActions }: ModuleProps) {
    useRegisterModule({ actionModules: currentPathActions, permission, modulePath: currentPath.path });

    const router = useRouter();
    const params = useParams();
    const id = Array.isArray(params.slug) ? params.slug.at(-2) ?? '' : '';

    const [dn, setDn] = useState<DeliveryNote | null>(null);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
    const [confirmAction, setConfirmAction] = useState<'confirm' | 'cancel' | null>(null);
    const [processing, setProcessing] = useState(false);

    function load() {
        const found = getDeliveryNote(id);
        setDn(found);
        setLoading(false);
    }

    useEffect(() => {
        if (id) load();
    }, [id]);

    function showToast(msg: string, type: 'success' | 'error') {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    }

    function handleConfirm() {
        if (!dn) return;
        setProcessing(true);
        const result = confirmDeliveryNote(dn.id);
        setProcessing(false);
        setConfirmAction(null);
        if (result.success) {
            showToast('Delivery note confirmed. Sales order quantities updated.', 'success');
            load();
        } else {
            showToast(result.error ?? 'Failed to confirm.', 'error');
        }
    }

    function handleCancel() {
        if (!dn) return;
        setProcessing(true);
        const result = cancelDeliveryNote(dn.id);
        setProcessing(false);
        setConfirmAction(null);
        if (result.success) {
            showToast('Delivery note cancelled.' + (dn.status === 'confirmed' ? ' Shipped quantities reversed.' : ''), 'success');
            load();
        } else {
            showToast(result.error ?? 'Failed to cancel.', 'error');
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2Icon className="animate-spin text-emerald-500" size={28} />
            </div>
        );
    }

    if (!dn) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
                <TruckIcon className="text-muted-foreground" size={40} />
                <p className="text-sm text-muted-foreground">Delivery note not found.</p>
                <button onClick={() => router.push('/sale/delivery-note')} className="text-xs text-sky-600 hover:underline">
                    Back to list
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {toast && (
                <div className={`fixed right-4 top-4 z-50 rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
                    {toast.msg}
                </div>
            )}

            {confirmAction && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
                    <div className="rounded-2xl bg-white p-6 shadow-xl w-80 space-y-4">
                        <h3 className="font-semibold text-sm">
                            {confirmAction === 'confirm' ? 'Confirm Delivery Note' : 'Cancel Delivery Note'}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                            {confirmAction === 'confirm'
                                ? 'This will update the sales order shipped quantities. This action cannot be easily reversed.'
                                : dn.status === 'confirmed'
                                    ? 'Cancelling a confirmed delivery will reverse the shipped quantities on the sales order.'
                                    : 'This draft delivery note will be cancelled.'}
                        </p>
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setConfirmAction(null)}
                                disabled={processing}
                                className="rounded-lg border px-3 py-1.5 text-xs hover:bg-muted font-mono"
                            >
                                Back
                            </button>
                            <button
                                onClick={confirmAction === 'confirm' ? handleConfirm : handleCancel}
                                disabled={processing}
                                className={`rounded-lg px-3 py-1.5 text-xs text-white font-mono disabled:opacity-60 ${confirmAction === 'confirm' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-500 hover:bg-rose-600'}`}
                            >
                                {processing ? 'Processing...' : 'Confirm'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex items-start justify-between">
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold tracking-tight">{dn.delivery_no}</h1>
                        <DNStatusBadge status={dn.status} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Delivery Note • ref: {dn.sales_order_no} • {dn.customer_name}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {dn.status === 'draft' && (
                        <button
                            onClick={() => setConfirmAction('confirm')}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 px-3 py-2 text-xs text-emerald-600 hover:bg-emerald-50 font-mono"
                        >
                            <CheckCircleIcon size={13} /> Confirm
                        </button>
                    )}
                    {dn.status !== 'cancelled' && (
                        <button
                            onClick={() => setConfirmAction('cancel')}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 font-mono"
                        >
                            <XCircleIcon size={13} /> Cancel
                        </button>
                    )}
                    <button
                        onClick={() => router.push('/sale/delivery-note')}
                        className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs hover:bg-muted font-mono"
                    >
                        <ArrowLeftIcon size={13} /> Back
                    </button>
                </div>
            </div>

            {/* Info */}
            <div className="grid grid-cols-2 gap-4">
                <Card className="border-none shadow-sm">
                    <CardHeader className="pb-2 pt-4 px-4">
                        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Delivery Info</CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 grid grid-cols-2 gap-y-3 text-xs font-mono">
                        <span className="text-muted-foreground">Sales Order</span>
                        <button
                            onClick={() => router.push(`/sale/order/${dn.sales_order_id}/view`)}
                            className="text-sky-600 hover:underline text-left font-medium"
                        >
                            {dn.sales_order_no}
                        </button>
                        <span className="text-muted-foreground">Customer</span><span className="font-medium">{dn.customer_name}</span>
                        <span className="text-muted-foreground">Delivery Date</span><span>{dn.delivery_date}</span>
                        <span className="text-muted-foreground">Warehouse</span><span>{dn.warehouse}</span>
                        {dn.receiver_name && (
                            <><span className="text-muted-foreground">Receiver</span><span>{dn.receiver_name}</span></>
                        )}
                        {dn.delivery_address && (
                            <><span className="text-muted-foreground">Address</span><span>{dn.delivery_address}</span></>
                        )}
                        {dn.notes && (
                            <><span className="text-muted-foreground">Notes</span><span>{dn.notes}</span></>
                        )}
                    </CardContent>
                </Card>

                <Card className="border-none shadow-sm">
                    <CardHeader className="pb-2 pt-4 px-4">
                        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 text-xs font-mono space-y-2">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Total Items</span>
                            <span className="font-semibold">{dn.items.length}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Total Units Shipped</span>
                            <span className="font-semibold">{dn.items.reduce((s, i) => s + i.shipment_qty, 0)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Created By</span>
                            <span>{dn.created_by}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Last Updated</span>
                            <span>{new Date(dn.updated_at).toLocaleDateString()}</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Items */}
            <Card className="border-none shadow-sm">
                <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Shipped Items</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs font-mono">
                            <thead>
                                <tr className="border-b text-muted-foreground">
                                    <th className="text-left py-2 pr-3 font-medium">Product</th>
                                    <th className="text-right py-2 pr-3 font-medium">Ordered</th>
                                    <th className="text-right py-2 pr-3 font-medium">Prev. Shipped</th>
                                    <th className="text-right py-2 pr-3 font-medium">This Shipment</th>
                                    <th className="text-right py-2 pr-3 font-medium">Remaining After</th>
                                    <th className="text-left py-2 font-medium">UOM</th>
                                </tr>
                            </thead>
                            <tbody>
                                {dn.items.map((item) => (
                                    <tr key={item.id} className="border-b hover:bg-muted/20">
                                        <td className="py-2 pr-3 font-medium">{item.product_name}</td>
                                        <td className="py-2 pr-3 text-right">{item.ordered_qty}</td>
                                        <td className="py-2 pr-3 text-right text-emerald-600">{item.previously_shipped_qty}</td>
                                        <td className="py-2 pr-3 text-right font-semibold text-sky-600">{item.shipment_qty}</td>
                                        <td className="py-2 pr-3 text-right">
                                            <span className={item.remaining_qty === 0 ? 'text-slate-400' : 'text-amber-600 font-medium'}>
                                                {item.remaining_qty}
                                            </span>
                                        </td>
                                        <td className="py-2">{item.uom}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
