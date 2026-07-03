'use client';

import AsyncSearchSelect from '@/components/ui/AsyncSearchSelect';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { API } from '@/lib/constant';
import { saleOrderApi } from '@/lib/api/sale';
import type { SalesOrder } from '@/types/sales/order-management';
import {
    AlertCircle,
    ArrowLeftIcon,
    ChevronRight,
    Loader2Icon,
    Package,
    PlusIcon,
    SaveIcon,
    Trash2Icon,
    X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const TABS = [
    { id: 'details' as const, label: 'Details', num: 1 },
    { id: 'items' as const, label: 'Order Items', num: 2 },
];
type TabId = (typeof TABS)[number]['id'];

type LineDraft = {
    key: string;
    id?: number; // DB id of an existing line (edit mode); absent for new lines
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
    return n.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
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

    const [activeTab, setActiveTab] = useState<TabId>('details');
    const [customerName, setCustomerName] = useState(
        initial?.customer_name ?? '',
    );
    const [customerPhone, setCustomerPhone] = useState(
        initial?.customer_phone ?? '',
    );
    const [orderDate, setOrderDate] = useState(
        initial?.order_date?.slice(0, 10) ?? today,
    );
    const [expectedDate, setExpectedDate] = useState(
        initial?.expected_delivery_date?.slice(0, 10) ?? '',
    );
    const [warehouseId, setWarehouseId] = useState<number | null>(
        initial?.warehouse_id ?? null,
    );
    const [warehouseName, setWarehouseName] = useState(
        initial?.warehouse_name ?? '',
    );
    const [currency, setCurrency] = useState(initial?.currency ?? 'USD');
    const [notes, setNotes] = useState(initial?.notes ?? '');
    const [items, setItems] = useState<LineDraft[]>(
        initial && initial.items.length
            ? initial.items.map((i) => ({
                  key: `l${keySeq++}`,
                  id: i.id,
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
        setItems((prev) =>
            prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)),
        );
    }

    const subtotal = items.reduce((s, i) => s + i.ordered_qty * i.unit_price, 0);
    const discountTotal = items.reduce(
        (s, i) => s + i.ordered_qty * i.unit_price * (i.discount / 100),
        0,
    );
    const taxTotal = items.reduce((s, i) => {
        const b = i.ordered_qty * i.unit_price * (1 - i.discount / 100);
        return s + b * (i.tax / 100);
    }, 0);
    const grandTotal = subtotal - discountTotal + taxTotal;

    async function handleSubmit() {
        setError('');
        if (!customerName.trim()) {
            setActiveTab('details');
            return setError('Customer name is required');
        }
        if (!warehouseId) {
            setActiveTab('details');
            return setError('Warehouse is required');
        }
        if (items.length === 0) {
            setActiveTab('items');
            return setError('Add at least one item');
        }
        for (const [i, l] of items.entries()) {
            if (!l.item_id) {
                setActiveTab('items');
                return setError(`Select a product on item ${i + 1}`);
            }
            if (l.ordered_qty <= 0) {
                setActiveTab('items');
                return setError(`Quantity must be greater than 0 on item ${i + 1}`);
            }
            if (l.unit_price < 0) {
                setActiveTab('items');
                return setError(`Invalid price on item ${i + 1}`);
            }
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
                    ...(l.id ? { id: l.id } : {}),
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
        <div className="space-y-4 font-mono text-xs">
            <div>
                <button
                    onClick={() => router.push('/sale/order')}
                    className="inline-flex items-center gap-2 text-slate-500 transition-colors hover:text-slate-700"
                >
                    <ArrowLeftIcon size={16} /> Back to Sales Orders
                </button>
                <h2 className="mt-3 flex items-center gap-2 text-2xl font-bold text-slate-800 md:text-3xl">
                    <Package className="text-[#1a9e52]" />
                    {mode === 'create'
                        ? 'New Sales Order'
                        : `Edit ${initial?.order_no ?? 'Sales Order'}`}
                </h2>
            </div>

            {error && (
                <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                    <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-500" />
                    <p className="text-red-700">{error}</p>
                    <button
                        type="button"
                        onClick={() => setError('')}
                        className="ml-auto shrink-0 text-red-400 hover:text-red-600"
                    >
                        <X size={16} />
                    </button>
                </div>
            )}

            <div className="grid gap-6 xl:grid-cols-[350px_minmax(0,1fr)]">
                {/* LEFT SIDEBAR — summary + actions */}
                <aside className="space-y-4 self-start xl:sticky xl:top-6">
                    <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
                        <div className="border-b border-slate-50 bg-slate-50/80 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                            Order Summary
                        </div>
                        <div className="space-y-2 p-4">
                            <div className="flex items-center justify-between">
                                <span className="text-slate-400">Customer</span>
                                <span className="font-semibold text-slate-700">
                                    {customerName || '—'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-slate-400">Items</span>
                                <span className="font-semibold text-slate-700">
                                    {items.length}
                                </span>
                            </div>
                            <div className="mt-2 space-y-1.5 rounded-xl bg-slate-50 p-3">
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Subtotal</span>
                                    <span>{fmt(subtotal)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Discount</span>
                                    <span className="text-rose-500">
                                        - {fmt(discountTotal)}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Tax</span>
                                    <span>{fmt(taxTotal)}</span>
                                </div>
                                <div className="flex justify-between border-t pt-1.5 text-sm font-semibold">
                                    <span>Grand Total</span>
                                    <span>
                                        {currency} {fmt(grandTotal)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </section>

                    <div className="flex flex-col-reverse gap-2">
                        <button
                            type="button"
                            onClick={() => router.push('/sale/order')}
                            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-center text-slate-600 transition-colors hover:bg-slate-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={saving}
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1a9e52] px-4 py-2.5 font-semibold text-white transition-colors hover:bg-[#158042] disabled:opacity-50"
                        >
                            {saving ? (
                                <Loader2Icon className="animate-spin" size={16} />
                            ) : (
                                <SaveIcon size={16} />
                            )}
                            {saving ? 'Saving...' : 'Save Order'}
                        </button>
                    </div>
                </aside>

                {/* RIGHT — tabs */}
                <div className="min-w-0">
                    <div className="flex gap-0 border-b border-slate-200">
                        {TABS.map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 border-b-2 px-5 py-3 transition-all ${
                                    activeTab === tab.id
                                        ? 'border-[#1a9e52] text-[#1a9e52]'
                                        : 'border-transparent text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                <span
                                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold transition-all ${
                                        activeTab === tab.id
                                            ? 'bg-[#1a9e52] text-white'
                                            : 'bg-slate-100 text-slate-500'
                                    }`}
                                >
                                    {tab.num}
                                </span>
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Tab 1: Details */}
                    {activeTab === 'details' && (
                        <div className="space-y-5 pt-5">
                            <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                                <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                                    Order Information
                                </h3>
                                <div className="grid gap-4 lg:grid-cols-2">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs">Customer Name *</Label>
                                        <Input
                                            value={customerName}
                                            onChange={(e) => setCustomerName(e.target.value)}
                                            placeholder="Customer name"
                                            className="text-xs font-mono"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs">Customer Phone</Label>
                                        <Input
                                            value={customerPhone ?? ''}
                                            onChange={(e) => setCustomerPhone(e.target.value)}
                                            placeholder="Optional"
                                            className="text-xs font-mono"
                                        />
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
                                        <Input
                                            value={currency}
                                            onChange={(e) => setCurrency(e.target.value)}
                                            className="text-xs font-mono"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs">Order Date *</Label>
                                        <Input
                                            type="date"
                                            value={orderDate}
                                            onChange={(e) => setOrderDate(e.target.value)}
                                            className="text-xs font-mono"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs">Expected Delivery Date</Label>
                                        <Input
                                            type="date"
                                            value={expectedDate}
                                            onChange={(e) => setExpectedDate(e.target.value)}
                                            className="text-xs font-mono"
                                        />
                                    </div>
                                    <div className="space-y-1.5 lg:col-span-2">
                                        <Label className="text-xs">Notes</Label>
                                        <textarea
                                            value={notes ?? ''}
                                            onChange={(e) => setNotes(e.target.value)}
                                            rows={3}
                                            placeholder="Optional notes..."
                                            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                                        />
                                    </div>
                                </div>
                            </section>

                            <div className="flex justify-end">
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('items')}
                                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-2.5 text-slate-600 transition-colors hover:bg-slate-50"
                                >
                                    Order Items <ChevronRight size={16} />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Tab 2: Order Items */}
                    {activeTab === 'items' && (
                        <div className="space-y-5 pt-5">
                            <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                                <div className="mb-4 flex items-center justify-between">
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                        Order Items
                                    </h3>
                                    <button
                                        type="button"
                                        onClick={() => setItems((p) => [...p, emptyLine()])}
                                        className="inline-flex items-center gap-1 rounded-lg bg-[#1a9e52] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#158042]"
                                    >
                                        <PlusIcon size={12} /> Add Item
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    {items.map((line, idx) => {
                                        const lineTotal =
                                            line.ordered_qty *
                                            line.unit_price *
                                            (1 - line.discount / 100) *
                                            (1 + line.tax / 100);
                                        return (
                                            <div
                                                key={line.key}
                                                className="rounded-xl border border-slate-200 p-3 space-y-3"
                                            >
                                                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
                                                    <AsyncSearchSelect
                                                        label="Product *"
                                                        placeholder="Select product..."
                                                        apiUrl={API.inventory.stockItem.root}
                                                        value={line.item_id}
                                                        selectedLabel={line.product_name}
                                                        enablePopupSearch
                                                        onChangeAction={(sel) =>
                                                            setLine(idx, {
                                                                item_id: sel?.id
                                                                    ? Number(sel.id)
                                                                    : null,
                                                                product_name: sel?.name ?? '',
                                                                item_uom_id: null,
                                                                uom: '',
                                                            })
                                                        }
                                                    />
                                                    {items.length > 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                setItems((p) =>
                                                                    p.filter((_, i) => i !== idx),
                                                                )
                                                            }
                                                            className="mt-6 h-9 w-9 shrink-0 rounded-lg border border-rose-200 text-rose-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                                                            title="Remove item"
                                                        >
                                                            <Trash2Icon size={14} className="mx-auto" />
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
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
                                                                    item_uom_id: sel?.id
                                                                        ? Number(sel.id)
                                                                        : null,
                                                                    uom: sel?.name ?? '',
                                                                })
                                                            }
                                                        />
                                                    ) : (
                                                        <div className="space-y-1.5">
                                                            <Label className="text-xs">UOM</Label>
                                                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-400">
                                                                Select a product first
                                                            </div>
                                                        </div>
                                                    )}
                                                    <div className="space-y-1.5">
                                                        <Label className="text-xs">Qty *</Label>
                                                        <Input
                                                            type="number"
                                                            min={0}
                                                            step="0.001"
                                                            value={line.ordered_qty}
                                                            onChange={(e) =>
                                                                setLine(idx, {
                                                                    ordered_qty: Number(e.target.value),
                                                                })
                                                            }
                                                            className="text-xs font-mono"
                                                        />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <Label className="text-xs">Unit Price *</Label>
                                                        <Input
                                                            type="number"
                                                            min={0}
                                                            step="0.0001"
                                                            value={line.unit_price}
                                                            onChange={(e) =>
                                                                setLine(idx, {
                                                                    unit_price: Number(e.target.value),
                                                                })
                                                            }
                                                            className="text-xs font-mono"
                                                        />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <Label className="text-xs">Disc %</Label>
                                                        <Input
                                                            type="number"
                                                            min={0}
                                                            max={100}
                                                            step="0.01"
                                                            value={line.discount}
                                                            onChange={(e) =>
                                                                setLine(idx, {
                                                                    discount: Number(e.target.value),
                                                                })
                                                            }
                                                            className="text-xs font-mono"
                                                        />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <Label className="text-xs">Tax %</Label>
                                                        <Input
                                                            type="number"
                                                            min={0}
                                                            max={100}
                                                            step="0.01"
                                                            value={line.tax}
                                                            onChange={(e) =>
                                                                setLine(idx, {
                                                                    tax: Number(e.target.value),
                                                                })
                                                            }
                                                            className="text-xs font-mono"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="text-right text-xs font-mono font-semibold text-slate-600">
                                                    Line Total: {fmt(lineTotal)}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </section>

                            <div className="flex justify-start">
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('details')}
                                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-2.5 text-slate-600 transition-colors hover:bg-slate-50"
                                >
                                    <ArrowLeftIcon size={16} /> Details
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
