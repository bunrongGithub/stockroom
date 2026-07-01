'use client';

import AsyncSearchSelect from '@/components/ui/AsyncSearchSelect';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { API } from '@/lib/constant';
import { saleOrderApi } from '@/lib/api/sale';
import type { SalesOrder } from '@/types/sales/order-management';
import { ArrowLeftIcon, PlusIcon, SaveIcon, Trash2Icon, Loader2Icon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

type LineDraft = {
    key: string;
    item_id: number | null;
    product_name: string;
    item_uom_id: number | null;
    uom: string;
    ordered_qty: number;
    unit_price: number;
    discount: number;
    tax: number;
};

let keySeq = 0;
function emptyLine(): LineDraft {
    return {
        key: `l${keySeq++}`,
        item_id: null,
        product_name: '',
        item_uom_id: null,
        uom: '',
        ordered_qty: 1,
        unit_price: 0,
        discount: 0,
        tax: 0,
    };
}

function fmt(n: number) {
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function OrderForm({
    mode,
    initial,
}: {
    mode: 'create' | 'edit';
    initial?: SalesOrder;
}) {
    const router = useRouter();
    const today = new Date().toISOString().slice(0, 10);

    const [customerName, setCustomerName] = useState(initial?.customer_name ?? '');
    const [customerPhone, setCustomerPhone] = useState(initial?.customer_phone ?? '');
    const [orderDate, setOrderDate] = useState(initial?.order_date?.slice(0, 10) ?? today);
    const [expectedDate, setExpectedDate] = useState(initial?.expected_delivery_date?.slice(0, 10) ?? '');
    const [warehouseId, setWarehouseId] = useState<number | null>(initial?.warehouse_id ?? null);
    const [warehouseName, setWarehouseName] = useState(initial?.warehouse_name ?? '');
    const [currency, setCurrency] = useState(initial?.currency ?? 'USD');
    const [notes, setNotes] = useState(initial?.notes ?? '');
    const [items, setItems] = useState<LineDraft[]>(
        initial && initial.items.length
            ? initial.items.map((i) => ({
                  key: `l${keySeq++}`,
                  item_id: i.item_id,
                  product_name: i.product_name,
                  item_uom_id: i.item_uom_id,
                  uom: i.uom,
                  ordered_qty: i.ordered_qty,
                  unit_price: i.unit_price,
                  discount: i.discount,
                  tax: i.tax,
              }))
            : [emptyLine()],
    );
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    function setLine(idx: number, patch: Partial<LineDraft>) {
        setItems((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
    }

    const subtotal = items.reduce((s, i) => s + i.ordered_qty * i.unit_price, 0);
    const discountTotal = items.reduce((s, i) => s + i.ordered_qty * i.unit_price * (i.discount / 100), 0);
    const taxTotal = items.reduce((s, i) => {
        const b = i.ordered_qty * i.unit_price * (1 - i.discount / 100);
        return s + b * (i.tax / 100);
    }, 0);
    const grandTotal = subtotal - discountTotal + taxTotal;

    async function handleSubmit() {
        setError('');
        if (!customerName.trim()) return setError('Customer name is required');
        if (!warehouseId) return setError('Warehouse is required');
        if (items.length === 0) return setError('Add at least one item');
        for (const [i, l] of items.entries()) {
            if (!l.item_id) return setError(`Select a product on line ${i + 1}`);
            if (l.ordered_qty <= 0) return setError(`Quantity must be greater than 0 on line ${i + 1}`);
            if (l.unit_price < 0) return setError(`Invalid price on line ${i + 1}`);
        }

        setSaving(true);
        try {
            const payload = {
                customer_name: customerName.trim(),
                customer_phone: customerPhone || undefined,
                order_date: orderDate,
                expected_delivery_date: expectedDate || undefined,
                warehouse_id: warehouseId,
                currency,
                notes: notes || undefined,
                items: items.map((l) => ({
                    item_id: l.item_id as number,
                    item_uom_id: l.item_uom_id ?? undefined,
                    description: l.product_name,
                    uom: l.uom,
                    ordered_qty: Number(l.ordered_qty),
                    unit_price: Number(l.unit_price),
                    discount: Number(l.discount),
                    tax: Number(l.tax),
                })),
            };
            const saved =
                mode === 'create'
                    ? await saleOrderApi.create(payload)
                    : await saleOrderApi.update(initial!.id, payload);
            router.push(`/sale/order/${saved.id}/view`);
            router.refresh();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to save order');
            setSaving(false);
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">
                        {mode === 'create' ? 'Create Sales Order' : `Edit ${initial?.order_no ?? 'Sales Order'}`}
                    </h1>
                    <p className="text-xs text-muted-foreground mt-0.5">Fill in the order details below</p>
                </div>
                <button onClick={() => router.back()} className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs hover:bg-muted font-mono">
                    <ArrowLeftIcon size={13} /> Back
                </button>
            </div>

            {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">{error}</div>}

            <Card className="border-none shadow-sm">
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold">Order Information</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <Label className="text-xs">Customer Name *</Label>
                        <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Customer name" className="text-xs font-mono" />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs">Customer Phone</Label>
                        <Input value={customerPhone ?? ''} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="Optional" className="text-xs font-mono" />
                    </div>
                    <AsyncSearchSelect
                        label="Warehouse *"
                        placeholder="Select warehouse..."
                        apiUrl={API.inventory.warehouse.root}
                        value={warehouseId}
                        selectedLabel={warehouseName}
                        enablePopupSearch
                        onChangeAction={(sel) => {
                            setWarehouseId(sel?.id ? Number(sel.id) : null);
                            setWarehouseName(sel?.name ?? '');
                        }}
                    />
                    <div className="space-y-1.5">
                        <Label className="text-xs">Currency</Label>
                        <Input value={currency} onChange={(e) => setCurrency(e.target.value)} className="text-xs font-mono" />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs">Order Date *</Label>
                        <Input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} className="text-xs font-mono" />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs">Expected Delivery Date</Label>
                        <Input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} className="text-xs font-mono" />
                    </div>
                    <div className="col-span-2 space-y-1.5">
                        <Label className="text-xs">Notes</Label>
                        <textarea value={notes ?? ''} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Optional notes..." className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-ring" />
                    </div>
                </CardContent>

                <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <CardTitle className="text-sm font-semibold">Order Items</CardTitle>
                    <button onClick={() => setItems((p) => [...p, emptyLine()])} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs text-white hover:bg-emerald-500 font-mono">
                        <PlusIcon size={12} /> Add Item
                    </button>
                </CardHeader>
                <CardContent className="space-y-4">
                    {items.map((line, idx) => {
                        const lineTotal = line.ordered_qty * line.unit_price * (1 - line.discount / 100) * (1 + line.tax / 100);
                        return (
                            <div key={line.key} className="rounded-xl border border-slate-200 p-3 space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-slate-500">Line {idx + 1}</span>
                                    {items.length > 1 && (
                                        <button onClick={() => setItems((p) => p.filter((_, i) => i !== idx))} className="text-rose-400 hover:text-rose-600" title="Remove">
                                            <Trash2Icon size={14} />
                                        </button>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <AsyncSearchSelect
                                        label="Product *"
                                        placeholder="Select product..."
                                        apiUrl={API.inventory.stockItem.root}
                                        value={line.item_id}
                                        selectedLabel={line.product_name}
                                        enablePopupSearch
                                        onChangeAction={(sel) =>
                                            setLine(idx, {
                                                item_id: sel?.id ? Number(sel.id) : null,
                                                product_name: sel?.name ?? '',
                                                // reset UOM when product changes
                                                item_uom_id: null,
                                                uom: '',
                                            })
                                        }
                                    />
                                    {line.item_id ? (
                                        <AsyncSearchSelect
                                            key={line.item_id}
                                            label="UOM"
                                            placeholder="Select UOM..."
                                            apiUrl={`${API.inventory.itemUom.root}?item_id=${line.item_id}`}
                                            value={line.item_uom_id}
                                            selectedLabel={line.uom}
                                            enablePopupSearch
                                            onChangeAction={(sel) =>
                                                setLine(idx, {
                                                    item_uom_id: sel?.id ? Number(sel.id) : null,
                                                    uom: sel?.name ?? '',
                                                })
                                            }
                                        />
                                    ) : (
                                        <div className="space-y-1.5">
                                            <Label className="text-xs">UOM</Label>
                                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-400">Select a product first</div>
                                        </div>
                                    )}
                                </div>
                                <div className="grid grid-cols-4 gap-3">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs">Qty *</Label>
                                        <Input type="number" min={0} step="0.001" value={line.ordered_qty} onChange={(e) => setLine(idx, { ordered_qty: Number(e.target.value) })} className="text-xs font-mono" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs">Unit Price *</Label>
                                        <Input type="number" min={0} step="0.0001" value={line.unit_price} onChange={(e) => setLine(idx, { unit_price: Number(e.target.value) })} className="text-xs font-mono" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs">Disc %</Label>
                                        <Input type="number" min={0} max={100} step="0.01" value={line.discount} onChange={(e) => setLine(idx, { discount: Number(e.target.value) })} className="text-xs font-mono" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs">Tax %</Label>
                                        <Input type="number" min={0} max={100} step="0.01" value={line.tax} onChange={(e) => setLine(idx, { tax: Number(e.target.value) })} className="text-xs font-mono" />
                                    </div>
                                </div>
                                <div className="text-right text-xs font-mono font-semibold">Line Total: {fmt(lineTotal)}</div>
                            </div>
                        );
                    })}

                    <div className="flex justify-end">
                        <div className="w-64 space-y-1.5 text-xs font-mono">
                            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{fmt(subtotal)}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span className="text-rose-500">- {fmt(discountTotal)}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span>{fmt(taxTotal)}</span></div>
                            <div className="flex justify-between border-t pt-1.5 font-semibold text-sm"><span>Grand Total</span><span>{currency} {fmt(grandTotal)}</span></div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="flex justify-end gap-2">
                <button onClick={() => router.back()} className="rounded-xl border px-4 py-2 text-xs hover:bg-muted font-mono">Discard</button>
                <button onClick={handleSubmit} disabled={saving} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs text-white hover:bg-emerald-500 font-mono disabled:opacity-60">
                    {saving ? <Loader2Icon size={13} className="animate-spin" /> : <SaveIcon size={13} />}
                    {saving ? 'Saving...' : 'Save Order'}
                </button>
            </div>
        </div>
    );
}
