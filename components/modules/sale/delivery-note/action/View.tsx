'use client';

import { useRegisterModule } from '@/hook/useModule';
import type { ModuleProps } from '@/lib/registry';
import { getOrders, createDeliveryNote } from '@/lib/mock-sales-store';
import type { SalesOrder } from '@/types/sales/order-management';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeftIcon, TruckIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ShipLine {
    soItemId: string;
    product_name: string;
    uom: string;
    ordered_qty: number;
    shipped_qty: number;
    remaining_qty: number;
    shipment_qty: number;
}

export default function SaleDeliveryNoteCreate({ currentPath, permission, currentPathActions }: ModuleProps) {
    useRegisterModule({ actionModules: currentPathActions, permission, modulePath: currentPath.path });

    const router = useRouter();
    const today = new Date().toISOString().slice(0, 10);

    const [allOrders, setAllOrders] = useState<SalesOrder[]>([]);
    const [selectedOrderId, setSelectedOrderId] = useState('');
    const [selectedOrder, setSelectedOrder] = useState<SalesOrder | null>(null);
    const [lines, setLines] = useState<ShipLine[]>([]);

    const [deliveryDate, setDeliveryDate] = useState(today);
    const [receiverName, setReceiverName] = useState('');
    const [deliveryAddress, setDeliveryAddress] = useState('');
    const [notes, setNotes] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const [globalError, setGlobalError] = useState('');

    useEffect(() => {
        const orders = getOrders().filter(
            (o) => o.status === 'open' || o.status === 'partial_shipment'
        );
        setAllOrders(orders);

        const preselectedId =
            typeof window !== 'undefined' ? sessionStorage.getItem('pending_dn_order_id') ?? '' : '';
        if (preselectedId) {
            const found = orders.find((o) => o.id === preselectedId);
            if (found) {
                setSelectedOrderId(found.id);
                loadOrderLines(found);
                sessionStorage.removeItem('pending_dn_order_id');
            }
        }
    }, []);

    function loadOrderLines(order: SalesOrder) {
        setSelectedOrder(order);
        const shippable = order.items.filter((i) => i.ordered_qty - i.shipped_qty > 0);
        setLines(
            shippable.map((i) => ({
                soItemId: i.id,
                product_name: i.product_name,
                uom: i.uom,
                ordered_qty: i.ordered_qty,
                shipped_qty: i.shipped_qty,
                remaining_qty: i.ordered_qty - i.shipped_qty,
                shipment_qty: i.ordered_qty - i.shipped_qty,
            }))
        );
        setErrors({});
        setGlobalError('');
    }

    function handleOrderChange(orderId: string) {
        setSelectedOrderId(orderId);
        const order = allOrders.find((o) => o.id === orderId);
        if (order) {
            loadOrderLines(order);
        } else {
            setSelectedOrder(null);
            setLines([]);
        }
    }

    function setShipQty(idx: number, value: number) {
        setLines((prev) => {
            const next = [...prev];
            next[idx] = { ...next[idx], shipment_qty: value };
            return next;
        });
    }

    function validate(): boolean {
        const errs: Record<string, string> = {};
        if (!selectedOrderId) errs.order = 'Select a sales order';
        if (!deliveryDate) errs.date = 'Delivery date is required';
        const activeLines = lines.filter((l) => l.shipment_qty > 0);
        if (activeLines.length === 0) errs.lines = 'Enter shipment quantity for at least one item';
        lines.forEach((l, i) => {
            if (l.shipment_qty < 0) errs[`line_${i}`] = 'Cannot be negative';
            if (l.shipment_qty > l.remaining_qty) errs[`line_${i}`] = `Max ${l.remaining_qty}`;
        });
        setErrors(errs);
        return Object.keys(errs).length === 0;
    }

    function handleSubmit() {
        if (!validate() || !selectedOrder) return;
        setSaving(true);
        setGlobalError('');

        const activeLines = lines.filter((l) => l.shipment_qty > 0);
        const result = createDeliveryNote({
            sales_order_id: selectedOrder.id,
            delivery_date: deliveryDate,
            receiver_name: receiverName,
            delivery_address: deliveryAddress,
            notes,
            items: activeLines.map((l) => ({
                sales_order_item_id: l.soItemId,
                shipment_qty: l.shipment_qty,
            })),
        });

        setSaving(false);
        if ('error' in result) {
            setGlobalError(result.error);
            return;
        }
        router.push(`/sale/delivery-note/${result.id}/view`);
    }

    const shippableOrders = allOrders;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Create Delivery Note</h1>
                    <p className="text-xs text-muted-foreground mt-0.5">Record shipment from a sales order</p>
                </div>
                <button
                    onClick={() => router.push('/sale/delivery-note')}
                    className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs hover:bg-muted font-mono"
                >
                    <ArrowLeftIcon size={13} /> Back
                </button>
            </div>

            {globalError && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-xs text-rose-600 font-mono">
                    {globalError}
                </div>
            )}

            <Card className="border-none shadow-sm">
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold">Delivery Information</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5 col-span-2">
                        <Label className="text-xs">Sales Order *</Label>
                        {shippableOrders.length === 0 ? (
                            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 font-mono">
                                No open or partial shipment orders available.
                            </div>
                        ) : (
                            <select
                                value={selectedOrderId}
                                onChange={(e) => handleOrderChange(e.target.value)}
                                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                            >
                                <option value="">— Select sales order —</option>
                                {shippableOrders.map((o) => (
                                    <option key={o.id} value={o.id}>
                                        {o.order_no} — {o.customer_name} ({o.status})
                                    </option>
                                ))}
                            </select>
                        )}
                        {errors.order && <p className="text-xs text-rose-500">{errors.order}</p>}
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-xs">Delivery Date *</Label>
                        <Input
                            type="date"
                            value={deliveryDate}
                            onChange={(e) => setDeliveryDate(e.target.value)}
                            className="text-xs font-mono"
                        />
                        {errors.date && <p className="text-xs text-rose-500">{errors.date}</p>}
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-xs">Receiver Name</Label>
                        <Input
                            value={receiverName}
                            onChange={(e) => setReceiverName(e.target.value)}
                            placeholder="Name of receiver"
                            className="text-xs font-mono"
                        />
                    </div>

                    <div className="space-y-1.5 col-span-2">
                        <Label className="text-xs">Delivery Address</Label>
                        <Input
                            value={deliveryAddress}
                            onChange={(e) => setDeliveryAddress(e.target.value)}
                            placeholder="Delivery address"
                            className="text-xs font-mono"
                        />
                    </div>

                    <div className="space-y-1.5 col-span-2">
                        <Label className="text-xs">Notes</Label>
                        <Input
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Optional notes..."
                            className="text-xs font-mono"
                        />
                    </div>
                </CardContent>
            </Card>

            {selectedOrder && (
                <Card className="border-none shadow-sm">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold">
                            Shipment Items
                            <span className="ml-2 text-xs font-normal text-muted-foreground">
                                from {selectedOrder.order_no} — {selectedOrder.customer_name}
                            </span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {errors.lines && <p className="text-xs text-rose-500 mb-2">{errors.lines}</p>}
                        {lines.length === 0 ? (
                            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500 font-mono">
                                All items in this order have already been fully shipped.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs font-mono">
                                    <thead>
                                        <tr className="border-b text-muted-foreground">
                                            <th className="text-left py-2 pr-3 font-medium">Product</th>
                                            <th className="text-right py-2 pr-3 font-medium">Ordered</th>
                                            <th className="text-right py-2 pr-3 font-medium">Prev. Shipped</th>
                                            <th className="text-right py-2 pr-3 font-medium">Remaining</th>
                                            <th className="text-right py-2 pr-3 font-medium w-32">Ship Qty *</th>
                                            <th className="text-left py-2 font-medium">UOM</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {lines.map((line, idx) => (
                                            <tr key={line.soItemId} className="border-b hover:bg-muted/20">
                                                <td className="py-2 pr-3 font-medium">{line.product_name}</td>
                                                <td className="py-2 pr-3 text-right">{line.ordered_qty}</td>
                                                <td className="py-2 pr-3 text-right text-emerald-600">{line.shipped_qty}</td>
                                                <td className="py-2 pr-3 text-right text-amber-600 font-medium">{line.remaining_qty}</td>
                                                <td className="py-2 pr-3">
                                                    <Input
                                                        type="number"
                                                        min={0}
                                                        max={line.remaining_qty}
                                                        value={line.shipment_qty}
                                                        onChange={(e) => setShipQty(idx, Number(e.target.value))}
                                                        className={`text-xs font-mono text-right h-7 w-full ${errors[`line_${idx}`] ? 'border-rose-400' : ''}`}
                                                    />
                                                    {errors[`line_${idx}`] && (
                                                        <p className="text-xs text-rose-500 mt-0.5">{errors[`line_${idx}`]}</p>
                                                    )}
                                                </td>
                                                <td className="py-2">{line.uom}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            <div className="flex justify-end gap-2">
                <button
                    onClick={() => router.push('/sale/delivery-note')}
                    className="rounded-xl border px-4 py-2 text-xs hover:bg-muted font-mono"
                >
                    Discard
                </button>
                <button
                    onClick={handleSubmit}
                    disabled={saving || !selectedOrder || lines.length === 0}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs text-white hover:bg-emerald-500 font-mono disabled:opacity-50"
                >
                    <TruckIcon size={13} />
                    {saving ? 'Creating...' : 'Create Delivery Note'}
                </button>
            </div>
        </div>
    );
}
