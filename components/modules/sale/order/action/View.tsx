'use client';

import { useRegisterModule } from '@/hook/useModule';
import type { ModuleProps } from '@/lib/registry';
import { createOrder } from '@/lib/mock-sales-store';
import type { SalesOrderItem } from '@/types/sales/order-management';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PlusIcon, Trash2Icon, ArrowLeftIcon, SaveIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const MOCK_CUSTOMERS = [
    { id: 'cust-1', name: 'Acme Corporation' },
    { id: 'cust-2', name: 'Global Tech Ltd' },
    { id: 'cust-3', name: 'Sunrise Retail' },
    { id: 'cust-4', name: 'Metro Systems' },
];

const MOCK_PRODUCTS = [
    { id: 'prod-1', name: 'Laptop Pro 15"', price: 350 },
    { id: 'prod-2', name: 'Wireless Mouse', price: 45 },
    { id: 'prod-3', name: 'USB-C Hub', price: 40 },
    { id: 'prod-4', name: 'HDMI Cable 2m', price: 12 },
    { id: 'prod-5', name: 'Mechanical Keyboard', price: 95 },
    { id: 'prod-6', name: 'Monitor 27"', price: 280 },
];

const WAREHOUSES = ['Main Warehouse', 'Branch A', 'Branch B'];

type ItemDraft = Omit<SalesOrderItem, 'id' | 'shipped_qty' | 'line_total'>; // line_total is computed by the store

function emptyItem(): ItemDraft {
    return { product_id: '', product_name: '', description: '', ordered_qty: 1, unit_price: 0, discount: 0, tax: 0, uom: 'Unit' };
}

function calcLine(item: ItemDraft): number {
    const base = item.ordered_qty * item.unit_price;
    const afterDisc = base - base * (item.discount / 100);
    return afterDisc + afterDisc * (item.tax / 100);
}

function fmt(n: number) {
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function SaleOrderCreate({ currentPath, permission, currentPathActions }: ModuleProps) {
    useRegisterModule({ actionModules: currentPathActions, permission, modulePath: currentPath.path });

    const router = useRouter();
    const today = new Date().toISOString().slice(0, 10);

    const [customerId, setCustomerId] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [orderDate, setOrderDate] = useState(today);
    const [expectedDate, setExpectedDate] = useState('');
    const [warehouse, setWarehouse] = useState(WAREHOUSES[0]);
    const [currency, setCurrency] = useState('USD');
    const [notes, setNotes] = useState('');
    const [items, setItems] = useState<ItemDraft[]>([emptyItem()]);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);

    function setItem(idx: number, field: keyof ItemDraft, value: string | number) {
        setItems((prev) => {
            const next = [...prev];
            next[idx] = { ...next[idx], [field]: value };
            if (field === 'product_id') {
                const prod = MOCK_PRODUCTS.find((p) => p.id === value);
                if (prod) {
                    next[idx].product_name = prod.name;
                    next[idx].unit_price = prod.price;
                    next[idx].description = prod.name;
                }
            }
            return next;
        });
    }

    function addItem() {
        setItems((prev) => [...prev, emptyItem()]);
    }

    function removeItem(idx: number) {
        setItems((prev) => prev.filter((_, i) => i !== idx));
    }

    function validate(): boolean {
        const errs: Record<string, string> = {};
        if (!customerId) errs.customer = 'Customer is required';
        if (!orderDate) errs.orderDate = 'Order date is required';
        if (!expectedDate) errs.expectedDate = 'Expected delivery date is required';
        if (items.length === 0) errs.items = 'Add at least one item';
        items.forEach((item, i) => {
            if (!item.product_id) errs[`item_${i}_product`] = 'Select a product';
            if (item.ordered_qty <= 0) errs[`item_${i}_qty`] = 'Qty must be > 0';
            if (item.unit_price < 0) errs[`item_${i}_price`] = 'Invalid price';
        });
        setErrors(errs);
        return Object.keys(errs).length === 0;
    }

    function handleSubmit() {
        if (!validate()) return;
        setSaving(true);
        const order = createOrder({
            customer_id: customerId,
            customer_name: customerName,
            order_date: orderDate,
            expected_delivery_date: expectedDate,
            warehouse,
            currency,
            notes,
            items,
        });
        setSaving(false);
        router.push(`/sale/order/${order.id}/view`);
    }

    const subtotal = items.reduce((s, i) => s + i.ordered_qty * i.unit_price, 0);
    const discountTotal = items.reduce((s, i) => s + i.ordered_qty * i.unit_price * (i.discount / 100), 0);
    const taxTotal = items.reduce((s, i) => {
        const b = i.ordered_qty * i.unit_price * (1 - i.discount / 100);
        return s + b * (i.tax / 100);
    }, 0);
    const grandTotal = subtotal - discountTotal + taxTotal;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Create Sales Order</h1>
                    <p className="text-xs text-muted-foreground mt-0.5">Fill in the order details below</p>
                </div>
                <button
                    onClick={() => router.push('/sale/order')}
                    className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs hover:bg-muted font-mono"
                >
                    <ArrowLeftIcon size={13} /> Back
                </button>
            </div>

            <Card className="border-none shadow-sm">
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold">Order Information</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <Label className="text-xs">Customer *</Label>
                        <select
                            value={customerId}
                            onChange={(e) => {
                                setCustomerId(e.target.value);
                                const c = MOCK_CUSTOMERS.find((x) => x.id === e.target.value);
                                setCustomerName(c?.name ?? '');
                            }}
                            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                            <option value="">— Select customer —</option>
                            {MOCK_CUSTOMERS.map((c) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                        {errors.customer && <p className="text-xs text-rose-500">{errors.customer}</p>}
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-xs">Warehouse</Label>
                        <select
                            value={warehouse}
                            onChange={(e) => setWarehouse(e.target.value)}
                            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                            {WAREHOUSES.map((w) => (
                                <option key={w} value={w}>{w}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-xs">Order Date *</Label>
                        <Input
                            type="date"
                            value={orderDate}
                            onChange={(e) => setOrderDate(e.target.value)}
                            className="text-xs font-mono"
                        />
                        {errors.orderDate && <p className="text-xs text-rose-500">{errors.orderDate}</p>}
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-xs">Expected Delivery Date *</Label>
                        <Input
                            type="date"
                            value={expectedDate}
                            onChange={(e) => setExpectedDate(e.target.value)}
                            className="text-xs font-mono"
                        />
                        {errors.expectedDate && <p className="text-xs text-rose-500">{errors.expectedDate}</p>}
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-xs">Currency</Label>
                        <select
                            value={currency}
                            onChange={(e) => setCurrency(e.target.value)}
                            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                            {['USD', 'EUR', 'KHR', 'THB'].map((c) => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-1.5">
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

            <Card className="border-none shadow-sm">
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm font-semibold">Order Items</CardTitle>
                    <button
                        onClick={addItem}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs text-white hover:bg-emerald-500 font-mono"
                    >
                        <PlusIcon size={12} /> Add Item
                    </button>
                </CardHeader>
                <CardContent>
                    {errors.items && <p className="text-xs text-rose-500 mb-2">{errors.items}</p>}
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs font-mono">
                            <thead>
                                <tr className="border-b text-muted-foreground">
                                    <th className="text-left py-2 pr-2 font-medium w-40">Product</th>
                                    <th className="text-left py-2 pr-2 font-medium">Description</th>
                                    <th className="text-right py-2 pr-2 font-medium w-16">Qty</th>
                                    <th className="text-left py-2 pr-2 font-medium w-16">UOM</th>
                                    <th className="text-right py-2 pr-2 font-medium w-24">Unit Price</th>
                                    <th className="text-right py-2 pr-2 font-medium w-16">Disc %</th>
                                    <th className="text-right py-2 pr-2 font-medium w-16">Tax %</th>
                                    <th className="text-right py-2 pr-2 font-medium w-24">Line Total</th>
                                    <th className="w-8"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item, idx) => (
                                    <tr key={idx} className="border-b hover:bg-muted/20">
                                        <td className="py-2 pr-2">
                                            <select
                                                value={item.product_id}
                                                onChange={(e) => setItem(idx, 'product_id', e.target.value)}
                                                className="w-full rounded border border-input bg-background px-1.5 py-1 text-xs font-mono"
                                            >
                                                <option value="">— Select —</option>
                                                {MOCK_PRODUCTS.map((p) => (
                                                    <option key={p.id} value={p.id}>{p.name}</option>
                                                ))}
                                            </select>
                                            {errors[`item_${idx}_product`] && (
                                                <p className="text-xs text-rose-500 mt-0.5">{errors[`item_${idx}_product`]}</p>
                                            )}
                                        </td>
                                        <td className="py-2 pr-2">
                                            <Input
                                                value={item.description}
                                                onChange={(e) => setItem(idx, 'description', e.target.value)}
                                                className="text-xs font-mono h-7"
                                                placeholder="Description"
                                            />
                                        </td>
                                        <td className="py-2 pr-2">
                                            <Input
                                                type="number"
                                                min={1}
                                                value={item.ordered_qty}
                                                onChange={(e) => setItem(idx, 'ordered_qty', Number(e.target.value))}
                                                className="text-xs font-mono text-right h-7 w-16"
                                            />
                                        </td>
                                        <td className="py-2 pr-2">
                                            <Input
                                                value={item.uom}
                                                onChange={(e) => setItem(idx, 'uom', e.target.value)}
                                                className="text-xs font-mono h-7 w-16"
                                            />
                                        </td>
                                        <td className="py-2 pr-2">
                                            <Input
                                                type="number"
                                                min={0}
                                                step="0.01"
                                                value={item.unit_price}
                                                onChange={(e) => setItem(idx, 'unit_price', Number(e.target.value))}
                                                className="text-xs font-mono text-right h-7 w-24"
                                            />
                                        </td>
                                        <td className="py-2 pr-2">
                                            <Input
                                                type="number"
                                                min={0}
                                                max={100}
                                                value={item.discount}
                                                onChange={(e) => setItem(idx, 'discount', Number(e.target.value))}
                                                className="text-xs font-mono text-right h-7 w-16"
                                            />
                                        </td>
                                        <td className="py-2 pr-2">
                                            <Input
                                                type="number"
                                                min={0}
                                                max={100}
                                                value={item.tax}
                                                onChange={(e) => setItem(idx, 'tax', Number(e.target.value))}
                                                className="text-xs font-mono text-right h-7 w-16"
                                            />
                                        </td>
                                        <td className="py-2 pr-2 text-right font-semibold">
                                            {fmt(calcLine(item))}
                                        </td>
                                        <td className="py-2">
                                            {items.length > 1 && (
                                                <button
                                                    onClick={() => removeItem(idx)}
                                                    className="text-rose-400 hover:text-rose-600"
                                                >
                                                    <Trash2Icon size={13} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-4 flex justify-end">
                        <div className="w-64 space-y-1.5 text-xs font-mono">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Subtotal</span>
                                <span>{fmt(subtotal)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Discount</span>
                                <span className="text-rose-500">- {fmt(discountTotal)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Tax</span>
                                <span>{fmt(taxTotal)}</span>
                            </div>
                            <div className="flex justify-between border-t pt-1.5 font-semibold text-sm">
                                <span>Grand Total</span>
                                <span>{currency} {fmt(grandTotal)}</span>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="flex justify-end gap-2">
                <button
                    onClick={() => router.push('/sale/order')}
                    className="rounded-xl border px-4 py-2 text-xs hover:bg-muted font-mono"
                >
                    Discard
                </button>
                <button
                    onClick={handleSubmit}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs text-white hover:bg-emerald-500 font-mono disabled:opacity-60"
                >
                    <SaveIcon size={13} />
                    {saving ? 'Saving...' : 'Create Order'}
                </button>
            </div>
        </div>
    );
}
