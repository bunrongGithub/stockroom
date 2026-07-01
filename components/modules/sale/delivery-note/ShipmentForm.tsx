'use client';

import AsyncSearchSelect from '@/components/ui/AsyncSearchSelect';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { API } from '@/lib/constant';
import { saleShipmentApi } from '@/lib/api/sale';
import type { SalesOrder, SalesShipment } from '@/types/sales/order-management';
import { ArrowLeftIcon, SaveIcon, Loader2Icon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

type ShipLine = {
    sales_order_item_id: number;
    item_id: number;
    product_name: string;
    uom: string;
    item_uom_id: number | null;
    ordered_qty: number;
    previously_shipped_qty: number;
    remaining: number;
    location_id: number | null;
    location_name: string;
    shipment_qty: number;
};

function buildLines(order: SalesOrder, initial?: SalesShipment): ShipLine[] {
    if (initial) {
        // Edit: start from the shipment's own lines.
        return initial.items.map((s) => {
            const so = order.items.find((o) => o.id === s.sales_order_item_id);
            const previously = so ? so.shipped_qty : s.previously_shipped_qty;
            const ordered = so ? so.ordered_qty : s.ordered_qty;
            return {
                sales_order_item_id: s.sales_order_item_id,
                item_id: s.item_id,
                product_name: s.product_name,
                uom: s.uom,
                item_uom_id: s.item_uom_id,
                ordered_qty: ordered,
                previously_shipped_qty: previously,
                // remaining excludes this draft's own qty so it can be re-entered
                remaining: ordered - previously,
                location_id: s.location_id,
                location_name: s.location_name,
                shipment_qty: s.shipment_qty,
            };
        });
    }
    // Create: every order line that still has quantity to ship.
    return order.items
        .map((o) => {
            const remaining = o.ordered_qty - o.shipped_qty;
            return {
                sales_order_item_id: o.id,
                item_id: o.item_id,
                product_name: o.product_name,
                uom: o.uom,
                item_uom_id: o.item_uom_id,
                ordered_qty: o.ordered_qty,
                previously_shipped_qty: o.shipped_qty,
                remaining,
                location_id: null,
                location_name: '',
                shipment_qty: remaining,
            };
        })
        .filter((l) => l.remaining > 0);
}

export default function ShipmentForm({
    mode,
    order,
    initial,
}: {
    mode: 'create' | 'edit';
    order: SalesOrder;
    initial?: SalesShipment;
}) {
    const router = useRouter();
    const today = new Date().toISOString().slice(0, 10);

    const [deliveryDate, setDeliveryDate] = useState(initial?.delivery_date?.slice(0, 10) ?? today);
    const [receiverName, setReceiverName] = useState(initial?.receiver_name ?? '');
    const [deliveryAddress, setDeliveryAddress] = useState(initial?.delivery_address ?? '');
    const [notes, setNotes] = useState(initial?.notes ?? '');
    const [lines, setLines] = useState<ShipLine[]>(buildLines(order, initial));
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    function setLine(idx: number, patch: Partial<ShipLine>) {
        setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
    }

    async function handleSubmit() {
        setError('');
        const active = lines.filter((l) => l.shipment_qty > 0);
        if (active.length === 0) return setError('Enter a shipment quantity for at least one item');
        for (const l of active) {
            if (!l.location_id) return setError(`Select a stock location for ${l.product_name}`);
            if (l.shipment_qty > l.remaining) return setError(`Quantity for ${l.product_name} exceeds remaining (${l.remaining})`);
        }

        setSaving(true);
        try {
            const payload = {
                sales_order_id: order.id,
                customer_name: order.customer_name,
                delivery_date: deliveryDate,
                warehouse_id: order.warehouse_id,
                receiver_name: receiverName || undefined,
                delivery_address: deliveryAddress || undefined,
                notes: notes || undefined,
                items: active.map((l) => ({
                    sales_order_item_id: l.sales_order_item_id,
                    item_id: l.item_id,
                    location_id: l.location_id as number,
                    item_uom_id: l.item_uom_id ?? undefined,
                    ordered_qty: l.ordered_qty,
                    previously_shipped_qty: l.previously_shipped_qty,
                    shipment_qty: Number(l.shipment_qty),
                })),
            };
            const saved =
                mode === 'create'
                    ? await saleShipmentApi.create(payload)
                    : await saleShipmentApi.update(initial!.id, payload);
            router.push(`/sale/delivery-note/${saved.id}/view`);
            router.refresh();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to save shipment');
            setSaving(false);
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">
                        {mode === 'create' ? 'Create Shipment' : `Edit ${initial?.shipment_no ?? 'Shipment'}`}
                    </h1>
                    <p className="text-xs text-muted-foreground mt-0.5">For order {order.order_no} • {order.customer_name}</p>
                </div>
                <button onClick={() => router.back()} className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs hover:bg-muted font-mono">
                    <ArrowLeftIcon size={13} /> Back
                </button>
            </div>

            {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">{error}</div>}

            <Card className="border-none shadow-sm">
                <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Shipment Information</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <Label className="text-xs">Delivery Date *</Label>
                        <Input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} className="text-xs font-mono" />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs">Warehouse</Label>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-mono text-slate-600">{order.warehouse_name}</div>
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs">Receiver Name</Label>
                        <Input value={receiverName ?? ''} onChange={(e) => setReceiverName(e.target.value)} placeholder="Optional" className="text-xs font-mono" />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs">Delivery Address</Label>
                        <Input value={deliveryAddress ?? ''} onChange={(e) => setDeliveryAddress(e.target.value)} placeholder="Optional" className="text-xs font-mono" />
                    </div>
                    <div className="col-span-2 space-y-1.5">
                        <Label className="text-xs">Notes</Label>
                        <textarea value={notes ?? ''} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Optional notes..." className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-ring" />
                    </div>
                </CardContent>

                <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Shipment Items</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                    {lines.length === 0 ? (
                        <p className="py-6 text-center text-xs text-muted-foreground">Nothing left to ship on this order.</p>
                    ) : (
                        lines.map((line, idx) => (
                            <div key={line.sales_order_item_id} className="rounded-xl border border-slate-200 p-3 space-y-3">
                                <div className="flex items-center justify-between text-xs font-mono">
                                    <span className="font-semibold">{line.product_name}</span>
                                    <span className="text-muted-foreground">
                                        Ordered {line.ordered_qty} • Shipped {line.previously_shipped_qty} • Remaining <span className="text-amber-600 font-medium">{line.remaining}</span>
                                    </span>
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                    <AsyncSearchSelect
                                        label="Location *"
                                        placeholder="Select location..."
                                        apiUrl={API.inventory.warehouse.locations(order.warehouse_id)}
                                        value={line.location_id}
                                        selectedLabel={line.location_name}
                                        enablePopupSearch
                                        onChangeAction={(sel) => setLine(idx, { location_id: sel?.id ? Number(sel.id) : null, location_name: sel?.name ?? '' })}
                                    />
                                    <div className="space-y-1.5">
                                        <Label className="text-xs">UOM</Label>
                                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-mono text-slate-600">{line.uom || '—'}</div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs">Shipment Qty *</Label>
                                        <Input type="number" min={0} max={line.remaining} step="0.001" value={line.shipment_qty} onChange={(e) => setLine(idx, { shipment_qty: Number(e.target.value) })} className="text-xs font-mono" />
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </CardContent>
            </Card>

            <div className="flex justify-end gap-2">
                <button onClick={() => router.back()} className="rounded-xl border px-4 py-2 text-xs hover:bg-muted font-mono">Discard</button>
                <button onClick={handleSubmit} disabled={saving || lines.length === 0} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs text-white hover:bg-emerald-500 font-mono disabled:opacity-60">
                    {saving ? <Loader2Icon size={13} className="animate-spin" /> : <SaveIcon size={13} />}
                    {saving ? 'Saving...' : 'Save Shipment'}
                </button>
            </div>
        </div>
    );
}
