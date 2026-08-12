'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    ClipboardList,
    Package,
    SaveIcon,
    Truck,
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
import { EmptyState } from '@/components/ui/EmptyState';
import { PrototypeNotice } from './PrototypeNotice';
import {
    fmt,
    money,
    outstandingOf,
    purchaseStore,
    supplierOf,
    type Grn,
    type GrnLine,
} from './mock/data';

/**
 * Receive goods against a purchase order.
 *
 * A receipt is always raised FROM an order — that is what makes "outstanding"
 * meaningful and what lets the order close itself when the last unit arrives.
 * Quantities default to everything still owed, because full delivery is the
 * common case and the exception is worth typing.
 */
const TABS = [
    { id: 'details' as const, label: 'Details', num: 1 },
    { id: 'items' as const, label: 'Items', num: 2 },
];
type TabId = (typeof TABS)[number]['id'];

export default function GrnForm() {
    const router = useRouter();
    const params = useSearchParams();
    const preselected = Number(params.get('po')) || 0;

    const receivable = purchaseStore
        .listPos()
        .filter(
            (po) =>
                (po.status === 'OPEN' || po.status === 'PARTIALLY_RECEIVED') &&
                po.lines.some((l) => outstandingOf(l) > 0),
        );

    const [poId, setPoId] = useState(preselected);
    const [dnNo, setDnNo] = useState('');
    const [receiptDate, setReceiptDate] = useState(
        new Date().toISOString().slice(0, 10),
    );
    const [notes, setNotes] = useState('');
    const [qty, setQty] = useState<Record<number, number>>({});
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState<TabId>('details');

    const po = poId ? purchaseStore.getPo(poId) : undefined;

    /** Outstanding lines, with the quantity the user has chosen to receive. */
    const rows = useMemo(() => {
        if (!po) return [];
        return po.lines
            .filter((l) => outstandingOf(l) > 0)
            .map((l) => ({
                line: l,
                outstanding: outstandingOf(l),
                receiving: qty[l.id] ?? outstandingOf(l),
            }));
    }, [po, qty]);

    const totalReceiving = rows.reduce((s, r) => s + r.receiving, 0);

    function post() {
        if (!po) return setError('Choose a purchase order to receive against.');
        if (totalReceiving <= 0) {
            return setError('Enter a quantity for at least one line.');
        }
        const over = rows.find((r) => r.receiving > r.outstanding);
        if (over) {
            return setError(
                `${over.line.description}: cannot receive ${over.receiving}, only ${over.outstanding} outstanding.`,
            );
        }

        const lines: GrnLine[] = rows
            .filter((r) => r.receiving > 0)
            .map((r, i) => ({
                id: i + 1,
                po_line_id: r.line.id,
                item_id: r.line.item_id,
                description: r.line.description,
                uom: r.line.uom,
                outstanding_qty: r.outstanding,
                received_qty: r.receiving,
                unit_cost: r.line.unit_cost,
            }));

        const grn: Grn = {
            id: purchaseStore.nextGrnId(),
            grn_no: purchaseStore.nextGrnNo(),
            po_id: po.id,
            supplier_id: po.supplier_id,
            supplier_dn_no: dnNo || null,
            receipt_date: receiptDate,
            warehouse: po.warehouse,
            status: 'POSTED',
            notes: notes || null,
            lines,
        };
        purchaseStore.postGrn(grn);
        router.push(`/purchase/grn/${grn.id}/view`);
    }

    return (
        <div className="space-y-4 font-mono text-xs">
            <FormHeader
                backHref="/purchase/grn"
                backLabel="Back"
                icon={<Truck />}
                title="New Goods Receipt"
                subtitle="Record what arrived from the supplier"
                actions={
                    <>
                        <HeaderAction label="Discard" href="/purchase/grn" />
                        <HeaderAction
                            label="Post Receipt"
                            icon={<SaveIcon size={16} />}
                            tone="primary"
                            onClick={post}
                            disabled={!po}
                        />
                    </>
                }
            />

            <PrototypeNotice>
                Sample data only. In the real system, posting a receipt is what
                writes the inventory ledger — which is why it is a separate step
                from saving a draft.
            </PrototypeNotice>

            {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
                    {error}
                </div>
            )}

            <FormLayout
                sidebar={
                    <SidebarCard icon={<Truck size={13} />} title="Receipt Summary">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-slate-400">Purchase Order</span>
                                <span className="font-semibold text-slate-700">
                                    {po?.po_no ?? '—'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-slate-400">Supplier</span>
                                <span className="min-w-0 truncate pl-3 font-semibold text-slate-700">
                                    {po ? (supplierOf(po.supplier_id)?.name ?? '—') : '—'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-slate-400">Receipt Date</span>
                                <span className="font-semibold text-slate-700">
                                    {receiptDate}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-slate-400">Lines</span>
                                <span className="font-semibold text-slate-700">
                                    {rows.length}
                                </span>
                            </div>

                            <div className="mt-2 space-y-1.5 rounded-xl bg-slate-50 p-3">
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Units</span>
                                    <span>{totalReceiving}</span>
                                </div>
                                <div className="flex justify-between border-t pt-1.5 text-sm font-semibold">
                                    <span>Receipt Value</span>
                                    <span>
                                        USD{' '}
                                        {fmt(
                                            rows.reduce(
                                                (s, r) =>
                                                    s + r.receiving * r.line.unit_cost,
                                                0,
                                            ),
                                        )}
                                    </span>
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
                            title="Receipt Information"
                        >
                <FieldGrid cols={2}>
                    <div>
                        <FieldLabel>GRN Number</FieldLabel>
                        <ReadonlyInput placeholder="Assigned on post" />
                    </div>
                    <div>
                        <FieldLabel required>Purchase Order</FieldLabel>
                        <EditableSelect
                            value={poId ? String(poId) : ''}
                            onChange={(e) => {
                                setPoId(Number(e.target.value));
                                setQty({});
                            }}
                        >
                            <option value="">Select purchase order…</option>
                            {receivable.map((o) => (
                                <option key={o.id} value={o.id}>
                                    {o.po_no} — {supplierOf(o.supplier_id)?.name}
                                </option>
                            ))}
                        </EditableSelect>
                    </div>
                    <div>
                        <FieldLabel>Supplier Delivery Note</FieldLabel>
                        <EditableInput
                            value={dnNo}
                            placeholder="Their DN number"
                            onChange={(e) => setDnNo(e.target.value)}
                        />
                    </div>
                    <div>
                        <FieldLabel required>Receipt Date</FieldLabel>
                        <EditableInput
                            type="date"
                            value={receiptDate}
                            onChange={(e) => setReceiptDate(e.target.value)}
                        />
                    </div>
                    <div>
                        <FieldLabel>Supplier</FieldLabel>
                        <ReadonlyInput
                            value={po ? (supplierOf(po.supplier_id)?.name ?? '') : ''}
                            placeholder="From the order"
                        />
                    </div>
                    <div>
                        <FieldLabel>Receive Into</FieldLabel>
                        <ReadonlyInput
                            value={po?.warehouse ?? ''}
                            placeholder="From the order"
                        />
                    </div>
                    <div className="lg:col-span-2">
                        <FieldLabel>Notes</FieldLabel>
                        <EditableTextarea
                            rows={3}
                            value={notes}
                            placeholder="Damage, short shipment, carton counts…"
                            onChange={(e) => setNotes(e.target.value)}
                        />
                    </div>
                            </FieldGrid>
                        </SectionCard>
                    </TabPanel>
                )}

                {activeTab === 'items' && (
                    <TabPanel>
            <SectionCard icon={<Package size={13} />} title="Items to Receive">
                {!po ? (
                    <EmptyState
                        compact
                        title="Choose a purchase order"
                        description={
                            receivable.length === 0
                                ? 'No open orders are waiting on goods right now.'
                                : 'Its outstanding lines will appear here, ready to receive.'
                        }
                    />
                ) : rows.length === 0 ? (
                    <EmptyState
                        compact
                        title="Nothing outstanding"
                        description="Every line on this order has already been received in full."
                    />
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-155 border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-200 text-left text-[10px] uppercase tracking-wider text-slate-400">
                                        <th className="pb-2 pr-3 font-medium">Product</th>
                                        <th className="pb-2 pr-3 text-right font-medium">Ordered</th>
                                        <th className="pb-2 pr-3 text-right font-medium">Outstanding</th>
                                        <th className="pb-2 pr-3 text-right font-medium">Receiving</th>
                                        <th className="pb-2 text-right font-medium">Value</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {rows.map(({ line, outstanding, receiving }) => (
                                        <tr key={line.id}>
                                            <td className="py-2 pr-3">
                                                <p className="font-medium text-slate-700">
                                                    {line.description}
                                                </p>
                                                <p className="text-[11px] text-slate-400">
                                                    {line.uom} ·{' '}
                                                    {money(line.unit_cost)} each
                                                </p>
                                            </td>
                                            <td className="py-2 pr-3 text-right tabular-nums text-slate-500">
                                                {line.ordered_qty}
                                            </td>
                                            <td className="py-2 pr-3 text-right font-semibold tabular-nums text-amber-700">
                                                {outstanding}
                                            </td>
                                            <td className="py-2 pr-3">
                                                <EditableInput
                                                    type="number"
                                                    min={0}
                                                    max={outstanding}
                                                    className="text-right"
                                                    value={receiving}
                                                    onChange={(e) =>
                                                        setQty((prev) => ({
                                                            ...prev,
                                                            [line.id]:
                                                                Number(e.target.value) || 0,
                                                        }))
                                                    }
                                                />
                                            </td>
                                            <td className="py-2 text-right font-semibold tabular-nums text-slate-700">
                                                {money(receiving * line.unit_cost)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                            <p className="text-slate-500">
                                Quantities default to everything still owed. Reduce a
                                line for a short delivery — the order stays open for
                                the rest.
                            </p>
                            <p className="shrink-0 text-sm">
                                <span className="text-slate-400">Receiving </span>
                                <span className="font-bold tabular-nums text-[#1a9e52]">
                                    {totalReceiving}
                                </span>
                                <span className="text-slate-400"> units</span>
                            </p>
                        </div>
                    </>
                )}
            </SectionCard>
                    </TabPanel>
                )}
            </FormLayout>
        </div>
    );
}
