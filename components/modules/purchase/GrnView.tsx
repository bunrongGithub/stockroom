'use client';

import { useState, useSyncExternalStore } from 'react';
import {
    ClipboardList,
    PackageIcon,
    ShoppingCart,
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
import { FieldLabel } from '@/components/ui/FieldLabel';
import { ReadonlyInput } from '@/components/ui/Readonly';
import { RelatedDocumentsPanel } from '@/components/ui/RelatedDocuments';
import { EmptyState } from '@/components/ui/EmptyState';
import { PrototypeNotice } from './PrototypeNotice';
import {
    GRN_STATUS_LABEL,
    PO_STATUS_LABEL,
    fmt,
    purchaseStore,
    supplierOf,
    type GrnStatus,
} from './mock/data';

/**
 * Goods Receipt detail — the Delivery Note detail's twin.
 *
 * Where a shipment points back at its sales order, a receipt points back at its
 * purchase order, so the Related Documents tab carries the order as the SOURCE
 * document rather than as something generated.
 */

const TABS = [
    { id: 'info' as const, label: 'Details', num: 1 },
    { id: 'items' as const, label: 'Items', num: 2 },
    { id: 'related' as const, label: 'Related Documents', num: 3 },
];
type TabId = (typeof TABS)[number]['id'];

const PO_STATUS_BADGE: Record<string, string> = {
    OPEN: 'bg-emerald-100 text-emerald-700',
    PARTIALLY_RECEIVED: 'bg-amber-100 text-amber-700',
    CLOSED: 'bg-sky-100 text-sky-700',
    CANCELLED: 'bg-rose-100 text-rose-700',
};

function StatusBadge({ status }: { status: GrnStatus }) {
    const map: Record<GrnStatus, string> = {
        DRAFT: 'bg-slate-100 text-slate-600',
        POSTED: 'bg-emerald-100 text-emerald-700',
        CANCELLED: 'bg-rose-100 text-rose-700',
    };
    return (
        <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${map[status]}`}
        >
            {GRN_STATUS_LABEL[status]}
        </span>
    );
}

export default function GrnView({ id }: { id: number }) {
    const receipts = useSyncExternalStore(
        purchaseStore.subscribe,
        purchaseStore.listGrns,
        purchaseStore.listGrns,
    );
    const [activeTab, setActiveTab] = useState<TabId>('info');
    const grn = receipts.find((g) => g.id === id);

    if (!grn) {
        return (
            <div className="space-y-4 font-mono text-xs">
                <FormHeader
                    backHref="/purchase/grn"
                    backLabel="Back"
                    icon={<Truck />}
                    title="Goods Receipt"
                />
                <EmptyState
                    title="Goods receipt not found"
                    description="Prototype data resets on reload, so a document created earlier will not survive a refresh."
                />
            </div>
        );
    }

    const po = purchaseStore.getPo(grn.po_id);
    const supplier = supplierOf(grn.supplier_id);
    const units = grn.lines.reduce((s, l) => s + l.received_qty, 0);
    const value = grn.lines.reduce((s, l) => s + l.received_qty * l.unit_cost, 0);
    const short = grn.lines.filter((l) => l.received_qty < l.outstanding_qty);

    return (
        <div className="space-y-4 font-mono text-xs">
            <FormHeader
                backHref="/purchase/grn"
                backLabel="Back"
                icon={<Truck />}
                title={grn.grn_no}
                badges={<StatusBadge status={grn.status} />}
                actions={
                    po && (
                        <HeaderAction
                            label="Purchase Order"
                            icon={<ShoppingCart size={16} />}
                            href={`/purchase/order/${po.id}/view`}
                        />
                    )
                }
            />

            <PrototypeNotice />

            <FormLayout
                sidebar={
                    <SidebarCard icon={<Truck size={13} />} title="Receipt Summary">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-slate-400">Supplier</span>
                                <span className="min-w-0 truncate pl-3 font-semibold text-slate-700">
                                    {supplier?.name ?? '—'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-slate-400">Purchase Order</span>
                                <span className="font-semibold text-slate-700">
                                    {po?.po_no ?? '—'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-slate-400">Receipt Date</span>
                                <span className="font-semibold text-slate-700">
                                    {grn.receipt_date}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-slate-400">Warehouse</span>
                                <span className="min-w-0 truncate pl-3 font-semibold text-slate-700">
                                    {grn.warehouse}
                                </span>
                            </div>

                            <div className="mt-2 space-y-1.5 rounded-xl bg-slate-50 p-3">
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Lines</span>
                                    <span>{grn.lines.length}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Units</span>
                                    <span>{units}</span>
                                </div>
                                <div className="flex justify-between border-t pt-1.5 text-sm font-semibold">
                                    <span>Receipt Value</span>
                                    <span>USD {fmt(value)}</span>
                                </div>
                            </div>
                        </div>
                    </SidebarCard>
                }
            >
                <TabNav tabs={TABS} active={activeTab} onChangeAction={setActiveTab} />

                {activeTab === 'info' && (
                    <TabPanel>
                        {short.length > 0 && (
                            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-amber-800">
                                Short delivery on {short.length} line
                                {short.length === 1 ? '' : 's'} — the order stays open
                                for the balance.
                            </div>
                        )}
                        <SectionCard
                            icon={<ClipboardList size={13} />}
                            title="Receipt Information"
                        >
                            <FieldGrid>
                                <div>
                                    <FieldLabel>Purchase Order</FieldLabel>
                                    <ReadonlyInput value={po?.po_no ?? ''} />
                                </div>
                                <div>
                                    <FieldLabel>Supplier</FieldLabel>
                                    <ReadonlyInput value={supplier?.name ?? ''} />
                                </div>
                                <div>
                                    <FieldLabel>Supplier Delivery Note</FieldLabel>
                                    <ReadonlyInput value={grn.supplier_dn_no ?? ''} />
                                </div>
                                <div>
                                    <FieldLabel>Receipt Date</FieldLabel>
                                    <ReadonlyInput value={grn.receipt_date} />
                                </div>
                                <div>
                                    <FieldLabel>Warehouse</FieldLabel>
                                    <ReadonlyInput value={grn.warehouse} />
                                </div>
                                <div>
                                    <FieldLabel>Status</FieldLabel>
                                    <ReadonlyInput
                                        value={GRN_STATUS_LABEL[grn.status]}
                                    />
                                </div>
                                <div className="lg:col-span-2">
                                    <FieldLabel>Notes</FieldLabel>
                                    <ReadonlyInput value={grn.notes ?? ''} />
                                </div>
                            </FieldGrid>
                        </SectionCard>
                    </TabPanel>
                )}

                {activeTab === 'items' && (
                    <TabPanel>
                        <SectionCard
                            icon={<PackageIcon size={13} />}
                            title="Received Items"
                        >
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs font-mono">
                                    <thead>
                                        <tr className="border-b text-muted-foreground">
                                            <th className="py-2 pr-3 text-left font-medium">Product</th>
                                            <th className="py-2 pr-3 text-right font-medium">Expected</th>
                                            <th className="py-2 pr-3 text-right font-medium">Received</th>
                                            <th className="py-2 pr-3 text-left font-medium">UOM</th>
                                            <th className="py-2 pr-3 text-right font-medium">Unit Cost</th>
                                            <th className="py-2 text-right font-medium">Value</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {grn.lines.map((line) => {
                                            const isShort =
                                                line.received_qty < line.outstanding_qty;
                                            return (
                                                <tr
                                                    key={line.id}
                                                    className="border-b last:border-0"
                                                >
                                                    <td className="py-2 pr-3">
                                                        {line.description}
                                                    </td>
                                                    <td className="py-2 pr-3 text-right tabular-nums">
                                                        {line.outstanding_qty}
                                                    </td>
                                                    <td className="py-2 pr-3 text-right tabular-nums">
                                                        <span
                                                            className={
                                                                isShort
                                                                    ? 'font-semibold text-amber-600'
                                                                    : ''
                                                            }
                                                        >
                                                            {line.received_qty}
                                                        </span>
                                                    </td>
                                                    <td className="py-2 pr-3">{line.uom}</td>
                                                    <td className="py-2 pr-3 text-right tabular-nums">
                                                        {fmt(line.unit_cost)}
                                                    </td>
                                                    <td className="py-2 text-right font-medium tabular-nums">
                                                        {fmt(
                                                            line.received_qty *
                                                                line.unit_cost,
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </SectionCard>
                    </TabPanel>
                )}

                {activeTab === 'related' && (
                    <TabPanel>
                        <RelatedDocumentsPanel
                            source={
                                po
                                    ? [
                                          {
                                              key: `po-${po.id}`,
                                              docType: 'Purchase Order',
                                              number: po.po_no,
                                              href: `/purchase/order/${po.id}/view`,
                                              date: po.order_date,
                                              status: PO_STATUS_LABEL[po.status],
                                              statusClass: PO_STATUS_BADGE[po.status],
                                              meta: [
                                                  {
                                                      label: 'Supplier',
                                                      value: supplier?.name ?? '—',
                                                  },
                                              ],
                                          },
                                      ]
                                    : []
                            }
                            sourceEmptyText="This receipt is not linked to a purchase order."
                            generated={[]}
                            generatedEmptyText="Nothing has been generated from this receipt yet."
                        />
                    </TabPanel>
                )}
            </FormLayout>
        </div>
    );
}
