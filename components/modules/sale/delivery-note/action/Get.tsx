'use client';

import { useRegisterModule } from '@/hook/useModule';
import type { ModuleProps } from '@/lib/registry';
import { saleShipmentApi } from '@/lib/api/sale';
import type { SalesShipment, SalesShipmentStatus } from '@/types/sales/order-management';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    ArrowLeftIcon,
    PencilIcon,
    SendIcon,
    Ban,
    Loader2Icon,
    PackageIcon,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function StatusBadge({ status }: { status: SalesShipmentStatus }) {
    const map: Record<SalesShipmentStatus, string> = {
        DRAFT: 'bg-gray-100 text-gray-600',
        POSTED: 'bg-emerald-100 text-emerald-700',
        VOID: 'bg-rose-100 text-rose-700',
    };
    return <span className={`inline-block rounded-full px-3 py-1 text-xs font-mono font-semibold ${map[status]}`}>{status}</span>;
}

export default function SaleShipmentDetail({ currentPath, permission, currentPathActions }: ModuleProps) {
    useRegisterModule({ actionModules: currentPathActions, permission, modulePath: currentPath.path });

    const router = useRouter();
    const params = useParams();
    const id = Array.isArray(params.slug) ? (params.slug.at(-2) ?? '') : '';

    const [shipment, setShipment] = useState<SalesShipment | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
    const [busy, setBusy] = useState<'post' | 'void' | null>(null);

    function showToast(msg: string, type: 'success' | 'error') {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 4000);
    }

    async function load() {
        setLoading(true);
        try {
            setShipment(await saleShipmentApi.get(id));
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load shipment');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (id) load();
    }, [id]);

    async function handlePost() {
        if (!shipment) return;
        setBusy('post');
        try {
            await saleShipmentApi.post(shipment.id);
            showToast('Shipment posted — stock updated.', 'success');
            await load();
        } catch (e) {
            showToast(e instanceof Error ? e.message : 'Failed to post shipment', 'error');
        } finally {
            setBusy(null);
        }
    }

    async function handleVoid() {
        if (!shipment) return;
        setBusy('void');
        try {
            await saleShipmentApi.void(shipment.id);
            showToast('Shipment voided.', 'success');
            await load();
        } catch (e) {
            showToast(e instanceof Error ? e.message : 'Failed to void shipment', 'error');
        } finally {
            setBusy(null);
        }
    }

    if (loading) {
        return <div className="flex items-center justify-center h-64"><Loader2Icon className="animate-spin text-emerald-500" size={28} /></div>;
    }

    if (error || !shipment) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
                <PackageIcon className="text-muted-foreground" size={40} />
                <p className="text-sm text-muted-foreground">{error || 'Shipment not found.'}</p>
                <button onClick={() => router.push('/sale/delivery-note')} className="text-xs text-sky-600 hover:underline">Back to list</button>
            </div>
        );
    }

    const a = shipment.actions;

    return (
        <div className="space-y-5">
            {toast && <div className={`fixed right-4 top-4 z-50 rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>{toast.msg}</div>}

            <div className="flex items-start justify-between">
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold tracking-tight">{shipment.shipment_no}</h1>
                        <StatusBadge status={shipment.status} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Shipment • Order{' '}
                        <button onClick={() => router.push(`/sale/order/${shipment.sales_order_id}/view`)} className="text-sky-600 hover:underline">{shipment.sales_order_no}</button>
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {a?.can_update && (
                        <button onClick={() => router.push(`/sale/delivery-note/${shipment.id}/update`)} className="inline-flex items-center gap-1.5 rounded-xl border border-violet-200 px-3 py-2 text-xs text-violet-600 hover:bg-violet-50 font-mono">
                            <PencilIcon size={13} /> Edit
                        </button>
                    )}
                    {a?.can_void && (
                        <button onClick={handleVoid} disabled={busy !== null} className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 hover:bg-rose-100 font-mono disabled:opacity-60">
                            {busy === 'void' ? <Loader2Icon size={13} className="animate-spin" /> : <Ban size={13} />} Void
                        </button>
                    )}
                    {a?.can_post && (
                        <button onClick={handlePost} disabled={busy !== null} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs text-white hover:bg-emerald-500 font-mono disabled:opacity-60">
                            {busy === 'post' ? <Loader2Icon size={13} className="animate-spin" /> : <SendIcon size={13} />} Post
                        </button>
                    )}
                    <button onClick={() => router.push('/sale/delivery-note')} className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs hover:bg-muted font-mono">
                        <ArrowLeftIcon size={13} /> Back
                    </button>
                </div>
            </div>

            <Card className="border-none shadow-sm">
                <CardHeader className="pb-2 pt-4 px-4"><CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Shipment Info</CardTitle></CardHeader>
                <CardContent className="px-4 pb-4 grid grid-cols-2 gap-y-3 text-xs font-mono">
                    <span className="text-muted-foreground">Customer</span><span className="font-medium">{shipment.customer_name || '—'}</span>
                    <span className="text-muted-foreground">Delivery Date</span><span>{shipment.delivery_date}</span>
                    <span className="text-muted-foreground">Warehouse</span><span>{shipment.warehouse_name}</span>
                    <span className="text-muted-foreground">Receiver</span><span>{shipment.receiver_name || '—'}</span>
                    <span className="text-muted-foreground">Address</span><span>{shipment.delivery_address || '—'}</span>
                    {shipment.notes && (<><span className="text-muted-foreground">Notes</span><span>{shipment.notes}</span></>)}
                </CardContent>

                <CardHeader className="pb-2 px-4"><CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Shipment Items</CardTitle></CardHeader>
                <CardContent className="px-4 pb-4">
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs font-mono">
                            <thead>
                                <tr className="border-b text-muted-foreground">
                                    <th className="text-left py-2 pr-3 font-medium">Product</th>
                                    <th className="text-left py-2 pr-3 font-medium">Location</th>
                                    <th className="text-left py-2 pr-3 font-medium">UOM</th>
                                    <th className="text-right py-2 pr-3 font-medium">Ordered</th>
                                    <th className="text-right py-2 pr-3 font-medium">Prev. Shipped</th>
                                    <th className="text-right py-2 font-medium">Shipment Qty</th>
                                </tr>
                            </thead>
                            <tbody>
                                {shipment.items.map((item) => (
                                    <tr key={item.id} className="border-b hover:bg-muted/20">
                                        <td className="py-2 pr-3 font-medium">{item.product_name}</td>
                                        <td className="py-2 pr-3">{item.location_name || '—'}</td>
                                        <td className="py-2 pr-3">{item.uom || '—'}</td>
                                        <td className="py-2 pr-3 text-right">{item.ordered_qty}</td>
                                        <td className="py-2 pr-3 text-right">{item.previously_shipped_qty}</td>
                                        <td className="py-2 text-right font-semibold text-emerald-600">{item.shipment_qty}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            <div className="text-xs text-muted-foreground font-mono">Last updated {new Date(shipment.updated_at).toLocaleString()}</div>
        </div>
    );
}
