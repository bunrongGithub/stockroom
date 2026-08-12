'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    ClipboardList,
    Package,
    Plus,
    ReceiptText,
    SaveIcon,
    ShoppingCart,
    Trash2,
} from 'lucide-react';

import {
    FieldGrid,
    FormHeader,
    FormLayout,
    HeaderAction,
    SectionCard,
    SidebarCard,
    TabNav,
    TabPanel,
} from '@/components/ui/FormShell';
import {
    EditableInput,
    EditableSelect,
    EditableTextarea,
    FieldLabel,
} from '@/components/ui/FieldLabel';
import { ReadonlyInput } from '@/components/ui/Readonly';
import { PrototypeNotice } from './PrototypeNotice';
import {
    PRODUCTS,
    SUPPLIERS,
    WAREHOUSES,
    fmt,
    money,
    poTotals,
    productOf,
    purchaseStore,
    type PoLine,
    type PurchaseOrder,
} from './mock/data';

const TABS = [
    { id: 'details' as const, label: 'Details', num: 1 },
    { id: 'items' as const, label: 'Items', num: 2 },
];
type TabId = (typeof TABS)[number]['id'];

const emptyLine = (id: number): PoLine => ({
    id,
    item_id: 0,
    description: '',
    uom: '',
    ordered_qty: 1,
    received_qty: 0,
    unit_cost: 0,
    discount: 0,
    tax: 0,
});

/**
 * Raise or amend a purchase order.
 *
 * Save and Discard sit in the header rather than under the lines, matching
 * every other document screen — on an order with twenty lines the primary
 * actions should not be a scroll away.
 */
export default function PurchaseOrderForm({
    existing,
}: {
    existing?: PurchaseOrder;
}) {
    const router = useRouter();
    const editing = Boolean(existing);

    const [supplierId, setSupplierId] = useState(existing?.supplier_id ?? 0);
    const [supplierRef, setSupplierRef] = useState(existing?.supplier_ref ?? '');
    const [orderDate, setOrderDate] = useState(
        existing?.order_date ?? new Date().toISOString().slice(0, 10),
    );
    const [expectedDate, setExpectedDate] = useState(existing?.expected_date ?? '');
    const [warehouse, setWarehouse] = useState(existing?.warehouse ?? WAREHOUSES[0]);
    const [notes, setNotes] = useState(existing?.notes ?? '');
    const [lines, setLines] = useState<PoLine[]>(
        existing?.lines.length
            ? existing.lines.map((l) => ({ ...l }))
            : [emptyLine(1)],
    );
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState<TabId>('details');

    const totals = useMemo(() => poTotals(lines), [lines]);
    const supplier = SUPPLIERS.find((s) => s.id === supplierId);

    const patchLine = (id: number, next: Partial<PoLine>) =>
        setLines((prev) =>
            prev.map((l) => (l.id === id ? { ...l, ...next } : l)),
        );

    /** Picking a product fills in what the item master already knows. */
    const pickProduct = (lineId: number, itemId: number) => {
        const product = productOf(itemId);
        patchLine(lineId, {
            item_id: itemId,
            description: product?.name ?? '',
            uom: product?.uom ?? '',
            unit_cost: product?.cost ?? 0,
        });
    };

    const addLine = () =>
        setLines((prev) => [
            ...prev,
            emptyLine(Math.max(0, ...prev.map((l) => l.id)) + 1),
        ]);

    const removeLine = (id: number) =>
        setLines((prev) =>
            prev.length === 1 ? prev : prev.filter((l) => l.id !== id),
        );

    function save() {
        if (!supplierId) return setError('Choose a supplier.');
        if (lines.some((l) => !l.item_id)) {
            return setError('Every line needs a product.');
        }
        if (lines.some((l) => l.ordered_qty <= 0)) {
            return setError('Ordered quantity must be greater than zero.');
        }

        const po: PurchaseOrder = {
            id: existing?.id ?? purchaseStore.nextPoId(),
            po_no: existing?.po_no ?? purchaseStore.nextPoNo(),
            supplier_id: supplierId,
            supplier_ref: supplierRef || null,
            order_date: orderDate,
            expected_date: expectedDate || null,
            warehouse,
            currency: existing?.currency ?? 'USD',
            status: existing?.status ?? 'OPEN',
            notes: notes || null,
            lines,
        };
        purchaseStore.savePo(po);
        router.push(`/purchase/order/${po.id}/view`);
    }

    return (
        <div className="space-y-4 font-mono text-xs">
            <FormHeader
                icon={<ShoppingCart size={24} />}
                title={editing ? existing!.po_no : 'New Purchase Order'}
                subtitle={editing ? 'Amend purchase order' : 'Order goods from a supplier'}
                actions={
                    <>
                        <HeaderAction label="Discard" href="/purchase/order" />
                        <HeaderAction
                            label="Save"
                            icon={<SaveIcon size={16} />}
                            tone="primary"
                            onClick={save}
                        />
                    </>
                }
            />

            <PrototypeNotice />

            {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
                    {error}
                </div>
            )}

            <FormLayout
                sidebar={
                    <SidebarCard icon={<ReceiptText size={13} />} title="Order Summary">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-slate-400">Supplier</span>
                                <span className="font-semibold text-slate-700">
                                    {supplier?.name ?? '—'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-slate-400">Order Date</span>
                                <span className="font-semibold text-slate-700">
                                    {orderDate}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-slate-400">Expected</span>
                                <span className="font-semibold text-slate-700">
                                    {expectedDate || '—'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-slate-400">Lines</span>
                                <span className="font-semibold text-slate-700">
                                    {lines.length}
                                </span>
                            </div>

                            <div className="mt-2 space-y-1.5 rounded-xl bg-slate-50 p-3">
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Subtotal</span>
                                    <span>{fmt(totals.subtotal)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Discount</span>
                                    <span className="text-rose-500">
                                        - {fmt(totals.discount)}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Tax</span>
                                    <span>{fmt(totals.tax)}</span>
                                </div>
                                <div className="flex justify-between border-t pt-1.5 text-sm font-semibold">
                                    <span>Grand Total</span>
                                    <span>USD {fmt(totals.total)}</span>
                                </div>
                            </div>
                        </div>
                    </SidebarCard>
                }
            >
                <TabNav tabs={TABS} active={activeTab} onChangeAction={setActiveTab} />

                {activeTab === 'details' && (
                    <TabPanel>
                        <SectionCard
                            icon={<ClipboardList size={13} />}
                            title="Order Information"
                        >
                <FieldGrid cols={2}>
                    <div>
                        <FieldLabel>PO Number</FieldLabel>
                        <ReadonlyInput
                            value={existing?.po_no ?? ''}
                            placeholder="Assigned on save"
                        />
                    </div>
                    <div>
                        <FieldLabel required>Supplier</FieldLabel>
                        <EditableSelect
                            value={supplierId ? String(supplierId) : ''}
                            onChange={(e) => setSupplierId(Number(e.target.value))}
                        >
                            <option value="">Select supplier…</option>
                            {SUPPLIERS.map((s) => (
                                <option key={s.id} value={s.id}>
                                    {s.name} — {s.terms}
                                </option>
                            ))}
                        </EditableSelect>
                    </div>
                    <div>
                        <FieldLabel>Supplier Reference</FieldLabel>
                        <EditableInput
                            value={supplierRef}
                            placeholder="Their quote or order number"
                            onChange={(e) => setSupplierRef(e.target.value)}
                        />
                    </div>
                    <div>
                        <FieldLabel required>Deliver To</FieldLabel>
                        <EditableSelect
                            value={warehouse}
                            onChange={(e) => setWarehouse(e.target.value)}
                        >
                            {WAREHOUSES.map((w) => (
                                <option key={w} value={w}>
                                    {w}
                                </option>
                            ))}
                        </EditableSelect>
                    </div>
                    <div>
                        <FieldLabel required>Order Date</FieldLabel>
                        <EditableInput
                            type="date"
                            value={orderDate}
                            onChange={(e) => setOrderDate(e.target.value)}
                        />
                    </div>
                    <div>
                        <FieldLabel>Expected Date</FieldLabel>
                        <EditableInput
                            type="date"
                            value={expectedDate}
                            onChange={(e) => setExpectedDate(e.target.value)}
                        />
                    </div>
                    <div className="lg:col-span-2">
                        <FieldLabel>Notes</FieldLabel>
                        <EditableTextarea
                            rows={3}
                            value={notes}
                            placeholder="Anything the warehouse or the supplier needs to know"
                            onChange={(e) => setNotes(e.target.value)}
                        />
                    </div>
                            </FieldGrid>
                        </SectionCard>
                    </TabPanel>
                )}

                {activeTab === 'items' && (
                    <TabPanel>
            <SectionCard
                icon={<Package size={13} />}
                title="Order Items"
                action={
                    <button
                        type="button"
                        onClick={addLine}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-slate-600 transition-colors hover:bg-slate-50"
                    >
                        <Plus size={13} /> Add line
                    </button>
                }
            >
                <div className="overflow-x-auto">
                    <table className="w-full min-w-205 border-collapse">
                        <thead>
                            <tr className="border-b border-slate-200 text-left text-[10px] uppercase tracking-wider text-slate-400">
                                <th className="pb-2 pr-3 font-medium">Product</th>
                                <th className="pb-2 pr-3 font-medium">UOM</th>
                                <th className="pb-2 pr-3 text-right font-medium">Qty</th>
                                <th className="pb-2 pr-3 text-right font-medium">Unit Cost</th>
                                <th className="pb-2 pr-3 text-right font-medium">Disc %</th>
                                <th className="pb-2 pr-3 text-right font-medium">Tax %</th>
                                <th className="pb-2 pr-3 text-right font-medium">Net</th>
                                <th className="pb-2 w-8" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {lines.map((line) => {
                                const gross = line.ordered_qty * line.unit_cost;
                                const afterDisc = gross - (gross * line.discount) / 100;
                                const net = afterDisc + (afterDisc * line.tax) / 100;
                                return (
                                    <tr key={line.id}>
                                        <td className="py-2 pr-3">
                                            <EditableSelect
                                                value={line.item_id ? String(line.item_id) : ''}
                                                onChange={(e) =>
                                                    pickProduct(line.id, Number(e.target.value))
                                                }
                                            >
                                                <option value="">Select product…</option>
                                                {PRODUCTS.map((p) => (
                                                    <option key={p.id} value={p.id}>
                                                        {p.name}
                                                    </option>
                                                ))}
                                            </EditableSelect>
                                        </td>
                                        <td className="py-2 pr-3 text-slate-500">
                                            {line.uom || '—'}
                                        </td>
                                        <td className="py-2 pr-3">
                                            <EditableInput
                                                type="number"
                                                min={0}
                                                step="1"
                                                className="text-right"
                                                value={line.ordered_qty}
                                                onChange={(e) =>
                                                    patchLine(line.id, {
                                                        ordered_qty: Number(e.target.value) || 0,
                                                    })
                                                }
                                            />
                                        </td>
                                        <td className="py-2 pr-3">
                                            <EditableInput
                                                type="number"
                                                min={0}
                                                step="0.01"
                                                className="text-right"
                                                value={line.unit_cost}
                                                onChange={(e) =>
                                                    patchLine(line.id, {
                                                        unit_cost: Number(e.target.value) || 0,
                                                    })
                                                }
                                            />
                                        </td>
                                        <td className="py-2 pr-3">
                                            <EditableInput
                                                type="number"
                                                min={0}
                                                max={100}
                                                className="text-right"
                                                value={line.discount}
                                                onChange={(e) =>
                                                    patchLine(line.id, {
                                                        discount: Number(e.target.value) || 0,
                                                    })
                                                }
                                            />
                                        </td>
                                        <td className="py-2 pr-3">
                                            <EditableInput
                                                type="number"
                                                min={0}
                                                max={100}
                                                className="text-right"
                                                value={line.tax}
                                                onChange={(e) =>
                                                    patchLine(line.id, {
                                                        tax: Number(e.target.value) || 0,
                                                    })
                                                }
                                            />
                                        </td>
                                        <td className="py-2 pr-3 text-right font-semibold tabular-nums text-slate-700">
                                            {money(net)}
                                        </td>
                                        <td className="py-2">
                                            <button
                                                type="button"
                                                onClick={() => removeLine(line.id)}
                                                disabled={lines.length === 1}
                                                title={
                                                    lines.length === 1
                                                        ? 'An order needs at least one line'
                                                        : 'Remove line'
                                                }
                                                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <div className="mt-4 flex justify-end">
                    <dl className="w-64 space-y-1.5">
                        {[
                            ['Subtotal', totals.subtotal],
                            ['Discount', -totals.discount],
                            ['Tax', totals.tax],
                        ].map(([label, value]) => (
                            <div key={label as string} className="flex justify-between">
                                <dt className="text-slate-400">{label}</dt>
                                <dd className="tabular-nums text-slate-600">
                                    {money(value as number)}
                                </dd>
                            </div>
                        ))}
                        <div className="flex justify-between border-t border-slate-200 pt-1.5 text-sm">
                            <dt className="font-semibold text-slate-700">Total</dt>
                            <dd className="font-bold tabular-nums text-[#1a9e52]">
                                {money(totals.total)}
                            </dd>
                        </div>
                    </dl>
                </div>
            </SectionCard>
                    </TabPanel>
                )}
            </FormLayout>
        </div>
    );
}
