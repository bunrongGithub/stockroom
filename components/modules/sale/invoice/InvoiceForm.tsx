'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { saleInvoiceApi } from '@/lib/api/sale';
import {
    AlertCircle,
    ArrowLeftIcon,
    ChevronRight,
    FileText,
    Loader2Icon,
    SaveIcon,
    X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const TABS = [
    { id: 'details' as const, label: 'Details', num: 1 },
    { id: 'items' as const, label: 'Invoice Items', num: 2 },
];
type TabId = (typeof TABS)[number]['id'];

export type InvoiceLineDraft = {
    key: string;
    id?: number;
    item_id: number;
    sales_order_item_id: number | null;
    shipment_item_id: number | null;
    product_name: string;
    uom: string;
    quantity: number;
    unit_price: number;
    discount: number;
    tax: number;
};

export type InvoiceHeaderDraft = {
    customer_name: string;
    customer_phone: string;
    customer_address: string;
    invoice_date: string;
    currency: string;
    exchange_rate: number;
    remarks: string;
};

function fmt(n: number) {
    return n.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function lineTotal(l: InvoiceLineDraft) {
    return (
        l.quantity * l.unit_price * (1 - l.discount / 100) * (1 + l.tax / 100)
    );
}

export default function InvoiceForm({
    mode,
    shipmentId,
    invoiceId,
    shipmentNo,
    orderNo,
    initialHeader,
    initialLines,
}: {
    mode: 'create' | 'edit';
    shipmentId: number;
    invoiceId?: number;
    shipmentNo: string;
    orderNo: string;
    initialHeader: InvoiceHeaderDraft;
    initialLines: InvoiceLineDraft[];
}) {
    const router = useRouter();

    const [activeTab, setActiveTab] = useState<TabId>('details');
    const [header, setHeader] = useState<InvoiceHeaderDraft>(initialHeader);
    const [lines, setLines] = useState<InvoiceLineDraft[]>(initialLines);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    function setH<K extends keyof InvoiceHeaderDraft>(
        key: K,
        value: InvoiceHeaderDraft[K],
    ) {
        setHeader((prev) => ({ ...prev, [key]: value }));
    }
    function setLine(idx: number, patch: Partial<InvoiceLineDraft>) {
        setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
    }

    const subtotal = lines.reduce((s, l) => s + l.quantity * l.unit_price, 0);
    const discountTotal = lines.reduce(
        (s, l) => s + l.quantity * l.unit_price * (l.discount / 100),
        0,
    );
    const taxTotal = lines.reduce((s, l) => {
        const b = l.quantity * l.unit_price * (1 - l.discount / 100);
        return s + b * (l.tax / 100);
    }, 0);
    const grandTotal = subtotal - discountTotal + taxTotal;

    async function handleSubmit() {
        setError('');
        if (!header.customer_name.trim()) {
            setActiveTab('details');
            return setError('Customer name is required');
        }
        if (lines.length === 0) {
            setActiveTab('items');
            return setError('Invoice has no items');
        }
        for (const [i, l] of lines.entries()) {
            if (l.quantity <= 0) {
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
            const items = lines.map((l) => ({
                ...(l.id ? { id: l.id } : {}),
                item_id: l.item_id,
                sales_order_item_id: l.sales_order_item_id ?? undefined,
                shipment_item_id: l.shipment_item_id ?? undefined,
                description: l.product_name,
                uom: l.uom,
                quantity: Number(l.quantity),
                unit_price: Number(l.unit_price),
                discount: Number(l.discount),
                tax: Number(l.tax),
            }));
            const headerPayload = {
                invoice_date: header.invoice_date,
                currency: header.currency,
                exchange_rate: Number(header.exchange_rate) || 1,
                customer_name: header.customer_name.trim(),
                customer_phone: header.customer_phone || undefined,
                customer_address: header.customer_address || undefined,
                remarks: header.remarks || undefined,
            };
            const saved =
                mode === 'create'
                    ? await saleInvoiceApi.createFromShipment({
                          shipment_id: shipmentId,
                          ...headerPayload,
                          items,
                      })
                    : await saleInvoiceApi.update(invoiceId!, {
                          ...headerPayload,
                          items,
                      });
            router.push(`/sale/invoice/${saved.id}/view`);
            router.refresh();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to save invoice');
            setSaving(false);
        }
    }

    return (
        <div className="space-y-4 font-mono text-xs">
            <div>
                <button
                    onClick={() => router.push('/sale/invoice')}
                    className="inline-flex items-center gap-2 text-slate-500 transition-colors hover:text-slate-700"
                >
                    <ArrowLeftIcon size={16} /> Back to Invoices
                </button>
                <h2 className="mt-3 flex items-center gap-2 text-2xl font-bold text-slate-800 md:text-3xl">
                    <FileText className="text-[#1a9e52]" />
                    {mode === 'create' ? 'New Sales Invoice' : 'Edit Invoice'}
                </h2>
                <p className="mt-1 text-slate-500">
                    From shipment {shipmentNo}
                    {orderNo ? ` • order ${orderNo}` : ''}
                </p>
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
                {/* LEFT SIDEBAR */}
                <aside className="space-y-4 self-start xl:sticky xl:top-6">
                    <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
                        <div className="border-b border-slate-50 bg-slate-50/80 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                            Invoice Summary
                        </div>
                        <div className="space-y-2 p-4">
                            <div className="flex items-center justify-between">
                                <span className="text-slate-400">Customer</span>
                                <span className="font-semibold text-slate-700">
                                    {header.customer_name || '—'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-slate-400">Shipment</span>
                                <span className="font-semibold text-slate-700">
                                    {shipmentNo}
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
                                        {header.currency} {fmt(grandTotal)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </section>

                    <div className="flex flex-col-reverse gap-2">
                        <button
                            type="button"
                            onClick={() => router.push('/sale/invoice')}
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
                            {saving ? 'Saving...' : 'Save Invoice'}
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
                                    Invoice Information
                                </h3>
                                <div className="grid gap-4 lg:grid-cols-2">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs">Customer Name *</Label>
                                        <Input
                                            value={header.customer_name}
                                            onChange={(e) => setH('customer_name', e.target.value)}
                                            className="text-xs font-mono"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs">Customer Phone</Label>
                                        <Input
                                            value={header.customer_phone}
                                            onChange={(e) => setH('customer_phone', e.target.value)}
                                            className="text-xs font-mono"
                                        />
                                    </div>
                                    <div className="space-y-1.5 lg:col-span-2">
                                        <Label className="text-xs">Customer Address</Label>
                                        <Input
                                            value={header.customer_address}
                                            onChange={(e) => setH('customer_address', e.target.value)}
                                            className="text-xs font-mono"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs">Invoice Date *</Label>
                                        <Input
                                            type="date"
                                            value={header.invoice_date}
                                            onChange={(e) => setH('invoice_date', e.target.value)}
                                            className="text-xs font-mono"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs">Currency</Label>
                                        <Input
                                            value={header.currency}
                                            onChange={(e) => setH('currency', e.target.value)}
                                            className="text-xs font-mono"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs">Exchange Rate</Label>
                                        <Input
                                            type="number"
                                            min={0}
                                            step="0.0001"
                                            value={header.exchange_rate}
                                            onChange={(e) => setH('exchange_rate', Number(e.target.value))}
                                            className="text-xs font-mono"
                                        />
                                    </div>
                                    <div className="space-y-1.5 lg:col-span-2">
                                        <Label className="text-xs">Remarks</Label>
                                        <textarea
                                            value={header.remarks}
                                            onChange={(e) => setH('remarks', e.target.value)}
                                            rows={3}
                                            placeholder="Optional remarks..."
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
                                    Invoice Items <ChevronRight size={16} />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Tab 2: Invoice Items */}
                    {activeTab === 'items' && (
                        <div className="space-y-5 pt-5">
                            <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                                <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                                    Invoice Items
                                </h3>
                                <div className="space-y-4">
                                    {lines.map((line, idx) => (
                                        <div
                                            key={line.key}
                                            className="rounded-xl border border-slate-200 p-3 space-y-3"
                                        >
                                            <div className="text-xs font-mono font-semibold text-slate-700">
                                                {line.product_name}
                                                <span className="ml-2 font-normal text-slate-400">
                                                    {line.uom || ''}
                                                </span>
                                            </div>
                                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                                <div className="space-y-1.5">
                                                    <Label className="text-xs">Qty *</Label>
                                                    <Input
                                                        type="number"
                                                        min={0}
                                                        step="0.001"
                                                        value={line.quantity}
                                                        onChange={(e) =>
                                                            setLine(idx, { quantity: Number(e.target.value) })
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
                                                            setLine(idx, { unit_price: Number(e.target.value) })
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
                                                            setLine(idx, { discount: Number(e.target.value) })
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
                                                            setLine(idx, { tax: Number(e.target.value) })
                                                        }
                                                        className="text-xs font-mono"
                                                    />
                                                </div>
                                            </div>
                                            <div className="text-right text-xs font-mono font-semibold text-slate-600">
                                                Line Total: {fmt(lineTotal(line))}
                                            </div>
                                        </div>
                                    ))}
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
