'use client';

import { useRegisterModule } from '@/hook/useModule';
import type { ModuleProps } from '@/lib/registry';
import { getDeliveryNote, confirmDeliveryNote, cancelDeliveryNote } from '@/lib/mock-sales-store';
import type { DeliveryNote } from '@/types/sales/order-management';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    ArrowLeftIcon, CheckCircleIcon, XCircleIcon, Loader2Icon, TruckIcon,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function SaleDeliveryNoteUpdate({ currentPath, permission, currentPathActions }: ModuleProps) {
    useRegisterModule({ actionModules: currentPathActions, permission, modulePath: currentPath.path });

    const router = useRouter();
    const params = useParams();
    const id = Array.isArray(params.slug) ? params.slug.at(-2) ?? '' : '';

    const [dn, setDn] = useState<DeliveryNote | null>(null);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

    useEffect(() => {
        if (id) {
            setDn(getDeliveryNote(id));
            setLoading(false);
        }
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
        if (result.success) {
            showToast('Delivery note confirmed. Sales order quantities updated.', 'success');
            setTimeout(() => router.push(`/sale/delivery-note/${dn.id}/view`), 1000);
        } else {
            showToast(result.error ?? 'Failed to confirm.', 'error');
        }
    }

    function handleCancel() {
        if (!dn) return;
        setProcessing(true);
        const result = cancelDeliveryNote(dn.id);
        setProcessing(false);
        if (result.success) {
            showToast('Delivery note cancelled.', 'success');
            setTimeout(() => router.push(`/sale/delivery-note/${dn.id}/view`), 1000);
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

    if (dn.status === 'cancelled') {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
                <XCircleIcon className="text-rose-400" size={40} />
                <p className="text-sm text-muted-foreground">{dn.delivery_no} is already cancelled.</p>
                <button onClick={() => router.push(`/sale/delivery-note/${dn.id}/view`)} className="text-xs text-sky-600 hover:underline">
                    View delivery note
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

            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">{dn.delivery_no}</h1>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        ref: {dn.sales_order_no} • {dn.customer_name} •
                        <span className={`ml-1 font-medium ${dn.status === 'draft' ? 'text-gray-500' : 'text-emerald-600'}`}>
                            {dn.status}
                        </span>
                    </p>
                </div>
                <button
                    onClick={() => router.push(`/sale/delivery-note/${dn.id}/view`)}
                    className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs hover:bg-muted font-mono"
                >
                    <ArrowLeftIcon size={13} /> Back
                </button>
            </div>

            <Card className="border-none shadow-sm">
                <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Items to Ship</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                    <table className="w-full text-xs font-mono">
                        <thead>
                            <tr className="border-b text-muted-foreground">
                                <th className="text-left py-2 pr-3 font-medium">Product</th>
                                <th className="text-right py-2 pr-3 font-medium">Ordered</th>
                                <th className="text-right py-2 pr-3 font-medium">Previously Shipped</th>
                                <th className="text-right py-2 pr-3 font-medium">This Shipment</th>
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
                                    <td className="py-2">{item.uom}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="border-t">
                                <td className="py-2 pr-3 font-semibold text-xs">Total Units</td>
                                <td colSpan={2} />
                                <td className="py-2 pr-3 text-right font-bold text-sky-600">
                                    {dn.items.reduce((s, i) => s + i.shipment_qty, 0)}
                                </td>
                                <td />
                            </tr>
                        </tfoot>
                    </table>
                </CardContent>
            </Card>

            {dn.status === 'draft' && (
                <Card className="border-none shadow-sm">
                    <CardContent className="px-4 py-5 space-y-4">
                        <div className="rounded-xl bg-sky-50 border border-sky-100 p-4 text-xs text-sky-700 font-mono space-y-1">
                            <p className="font-semibold">Ready to confirm?</p>
                            <p>Confirming will update the sales order shipped quantities and may automatically set the order status to <em>partial_shipment</em> or <em>closed</em>.</p>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={handleConfirm}
                                disabled={processing}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs text-white hover:bg-emerald-500 font-mono disabled:opacity-60"
                            >
                                <CheckCircleIcon size={13} />
                                {processing ? 'Confirming...' : 'Confirm Delivery Note'}
                            </button>
                            <button
                                onClick={handleCancel}
                                disabled={processing}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 px-4 py-2.5 text-xs text-rose-600 hover:bg-rose-50 font-mono disabled:opacity-60"
                            >
                                <XCircleIcon size={13} /> Discard Draft
                            </button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {dn.status === 'confirmed' && (
                <Card className="border-none shadow-sm">
                    <CardContent className="px-4 py-5 space-y-4">
                        <div className="rounded-xl bg-amber-50 border border-amber-100 p-4 text-xs text-amber-700 font-mono space-y-1">
                            <p className="font-semibold">Cancel confirmed delivery?</p>
                            <p>Cancelling will <strong>reverse</strong> the shipped quantities on the sales order and revert its status accordingly.</p>
                        </div>
                        <button
                            onClick={handleCancel}
                            disabled={processing}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs text-rose-600 hover:bg-rose-100 font-mono disabled:opacity-60"
                        >
                            <XCircleIcon size={13} />
                            {processing ? 'Cancelling...' : 'Cancel Delivery Note'}
                        </button>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
