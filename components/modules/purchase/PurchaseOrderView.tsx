'use client';

import { useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import {
    ClipboardList,
    PackageIcon,
    PencilIcon,
    ShoppingCart,
    Truck,
    XCircleIcon,
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
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { EmptyState } from '@/components/ui/EmptyState';
import { PrototypeNotice } from './PrototypeNotice';
import {
    PO_STATUS_LABEL,
    fmt,
    outstandingOf,
    poTotals,
    purchaseStore,
    supplierOf,
    type PoStatus,
} from './mock/data';

/**
 * Purchase Order detail — the Sale Order detail's twin.
 *
 * Same shell top to bottom: header with document number, status badge and the
 * action group; a persistent summary rail; and numbered tabs for Details,
 * Items and Related Documents. A buyer moving between Sale and Purchase should
 * not have to relearn where anything is.
 */

const TABS = [
    { id: 'info' as const, label: 'Details', num: 1 },
    { id: 'items' as const, label: 'Items', num: 2 },
    { id: 'related' as const, label: 'Related Documents', num: 3 },
];
type TabId = (typeof TABS)[number]['id'];

/** Local badge, mirroring the Sale Order detail's inline status badge. */
function StatusBadge({ status }: { status: PoStatus }) {
    const map: Record<PoStatus, string> = {
        OPEN: 'bg-emerald-100 text-emerald-700',
        PARTIALLY_RECEIVED: 'bg-amber-100 text-amber-700',
        CLOSED: 'bg-sky-100 text-sky-700',
        CANCELLED: 'bg-rose-100 text-rose-700',
    };
    return (
        <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${map[status]}`}
        >
            {PO_STATUS_LABEL[status]}
        </span>
    );
}

const GRN_STATUS_BADGE: Record<string, string> = {
    DRAFT: 'bg-slate-100 text-slate-600',
    POSTED: 'bg-emerald-100 text-emerald-700',
    CANCELLED: 'bg-rose-100 text-rose-700',
};

export default function PurchaseOrderView({ id }: { id: number }) {
    const router = useRouter();
    const toast = useToast();
    const orders = useSyncExternalStore(
        purchaseStore.subscribe,
        purchaseStore.listPos,
        purchaseStore.listPos,
    );
    const [activeTab, setActiveTab] = useState<TabId>('info');
    const [confirmCancel, setConfirmCancel] = useState(false);

    const po = orders.find((p) => p.id === id);

    if (!po) {
        return (
            <div className="space-y-4 font-mono text-xs">
                <FormHeader
                    backHref="/purchase/order"
                    backLabel="Back"
                    icon={<ShoppingCart />}
                    title="Purchase Order"
                />
                <EmptyState
                    title="Purchase order not found"
                    description="Prototype data resets on reload, so a document created earlier will not survive a refresh."
                />
            </div>
        );
    }

    const supplier = supplierOf(po.supplier_id);
    const totals = poTotals(po.lines);
    const receipts = purchaseStore.grnsForPo(po.id);
    const outstanding = po.lines.reduce((s, l) => s + outstandingOf(l), 0);

    // Editable and cancellable only while untouched — once a receipt is posted
    // the order has to be settled, not rewritten.
    const canEdit = po.status === 'OPEN';
    const canReceive =
        outstanding > 0 &&
        (po.status === 'OPEN' || po.status === 'PARTIALLY_RECEIVED');
    const canCancel = po.status === 'OPEN';

    return (
        <div className="space-y-4 font-mono text-xs">
            <FormHeader
                backHref="/purchase/order"
                backLabel="Back"
                icon={<ShoppingCart />}
                title={po.po_no}
                badges={<StatusBadge status={po.status} />}
                actions={
                    <>
                        {canEdit && (
                            <HeaderAction
                                label="Edit"
                                icon={<PencilIcon size={16} />}
                                href={`/purchase/order/${po.id}/update`}
                            />
                        )}
                        {canCancel && (
                            <HeaderAction
                                label="Cancel"
                                tone="danger"
                                icon={<XCircleIcon size={16} />}
                                onClick={() => setConfirmCancel(true)}
                            />
                        )}
                        {canReceive && (
                            <HeaderAction
                                label="Receive"
                                tone="primary"
                                icon={<Truck size={16} />}
                                onClick={() =>
                                    router.push(`/purchase/grn/create?po=${po.id}`)
                                }
                            />
                        )}
                    </>
                }
            />

            <PrototypeNotice />

            <FormLayout
                sidebar={
                    <SidebarCard
                        icon={<ClipboardList size={13} />}
                        title="Order Summary"
                    >
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
                                    {po.order_date}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-slate-400">Warehouse</span>
                                <span className="min-w-0 truncate pl-3 font-semibold text-slate-700">
                                    {po.warehouse}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-slate-400">Receipts</span>
                                <span className="font-semibold text-slate-700">
                                    {receipts.length}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-slate-400">Outstanding</span>
                                <span
                                    className={`font-semibold ${
                                        outstanding > 0
                                            ? 'text-amber-600'
                                            : 'text-slate-700'
                                    }`}
                                >
                                    {outstanding} units
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
                                    <span>
                                        {po.currency} {fmt(totals.total)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </SidebarCard>
                }
            >
                <TabNav tabs={TABS} active={activeTab} onChangeAction={setActiveTab} />

                {/* Tab 1: Order Information */}
                {activeTab === 'info' && (
                    <TabPanel>
                        <SectionCard
                            icon={<ClipboardList size={13} />}
                            title="Order Information"
                        >
                            <FieldGrid>
                                <div>
                                    <FieldLabel>Supplier Reference</FieldLabel>
                                    <ReadonlyInput value={po.supplier_ref ?? ''} />
                                </div>
                                <div>
                                    <FieldLabel>Supplier</FieldLabel>
                                    <ReadonlyInput value={supplier?.name ?? ''} />
                                </div>
                                <div>
                                    <FieldLabel>Phone</FieldLabel>
                                    <ReadonlyInput value={supplier?.phone ?? ''} />
                                </div>
                                <div>
                                    <FieldLabel>Payment Terms</FieldLabel>
                                    <ReadonlyInput value={supplier?.terms ?? ''} />
                                </div>
                                <div>
                                    <FieldLabel>Order Date</FieldLabel>
                                    <ReadonlyInput value={po.order_date} />
                                </div>
                                <div>
                                    <FieldLabel>Expected Date</FieldLabel>
                                    <ReadonlyInput value={po.expected_date ?? ''} />
                                </div>
                                <div>
                                    <FieldLabel>Warehouse</FieldLabel>
                                    <ReadonlyInput value={po.warehouse} />
                                </div>
                                <div>
                                    <FieldLabel>Currency</FieldLabel>
                                    <ReadonlyInput value={po.currency} />
                                </div>
                                <div className="lg:col-span-2">
                                    <FieldLabel>Notes</FieldLabel>
                                    <ReadonlyInput value={po.notes ?? ''} />
                                </div>
                            </FieldGrid>
                        </SectionCard>
                    </TabPanel>
                )}

                {/* Tab 2: Order Items */}
                {activeTab === 'items' && (
                    <TabPanel>
                        <SectionCard icon={<PackageIcon size={13} />} title="Order Items">
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs font-mono">
                                    <thead>
                                        <tr className="border-b text-muted-foreground">
                                            <th className="py-2 pr-3 text-left font-medium">Product</th>
                                            <th className="py-2 pr-3 text-right font-medium">Ordered</th>
                                            <th className="py-2 pr-3 text-right font-medium">Received</th>
                                            <th className="py-2 pr-3 text-right font-medium">Outstanding</th>
                                            <th className="py-2 pr-3 text-left font-medium">UOM</th>
                                            <th className="py-2 pr-3 text-right font-medium">Unit Cost</th>
                                            <th className="py-2 pr-3 text-right font-medium">Disc %</th>
                                            <th className="py-2 pr-3 text-right font-medium">Tax %</th>
                                            <th className="py-2 text-right font-medium">Net</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {po.lines.map((line) => {
                                            const gross = line.ordered_qty * line.unit_cost;
                                            const afterDisc =
                                                gross - (gross * line.discount) / 100;
                                            const net =
                                                afterDisc + (afterDisc * line.tax) / 100;
                                            const left = outstandingOf(line);
                                            return (
                                                <tr key={line.id} className="border-b last:border-0">
                                                    <td className="py-2 pr-3">{line.description}</td>
                                                    <td className="py-2 pr-3 text-right tabular-nums">
                                                        {line.ordered_qty}
                                                    </td>
                                                    <td className="py-2 pr-3 text-right tabular-nums">
                                                        {line.received_qty}
                                                    </td>
                                                    <td className="py-2 pr-3 text-right tabular-nums">
                                                        <span
                                                            className={
                                                                left > 0
                                                                    ? 'font-semibold text-amber-600'
                                                                    : 'text-muted-foreground'
                                                            }
                                                        >
                                                            {left}
                                                        </span>
                                                    </td>
                                                    <td className="py-2 pr-3">{line.uom}</td>
                                                    <td className="py-2 pr-3 text-right tabular-nums">
                                                        {fmt(line.unit_cost)}
                                                    </td>
                                                    <td className="py-2 pr-3 text-right tabular-nums">
                                                        {line.discount}
                                                    </td>
                                                    <td className="py-2 pr-3 text-right tabular-nums">
                                                        {line.tax}
                                                    </td>
                                                    <td className="py-2 text-right font-medium tabular-nums">
                                                        {fmt(net)}
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

                {/* Tab 3: Related Documents (document flow) */}
                {activeTab === 'related' && (
                    <TabPanel>
                        <RelatedDocumentsPanel
                            source={[]}
                            sourceEmptyText="This purchase order is the start of the document flow."
                            generated={receipts.map((g) => ({
                                key: `grn-${g.id}`,
                                docType: 'Goods Receipt',
                                number: g.grn_no,
                                href: `/purchase/grn/${g.id}/view`,
                                date: g.receipt_date,
                                status: g.status.toLowerCase(),
                                statusClass: GRN_STATUS_BADGE[g.status],
                                meta: [
                                    {
                                        label: 'Units',
                                        value: String(
                                            g.lines.reduce(
                                                (s, l) => s + l.received_qty,
                                                0,
                                            ),
                                        ),
                                    },
                                    {
                                        label: 'Supplier DN',
                                        value: g.supplier_dn_no || '—',
                                    },
                                ],
                            }))}
                            generatedEmptyText="No goods receipts have been created for this order yet."
                        />
                    </TabPanel>
                )}
            </FormLayout>

            <ConfirmDialog
                open={confirmCancel}
                onOpenChange={setConfirmCancel}
                title="Cancel Order"
                description={`Cancel ${po.po_no}? Orders with posted receipts cannot be cancelled.`}
                confirmLabel="Cancel Order"
                tone="danger"
                onConfirm={async () => {
                    purchaseStore.setPoStatus(po.id, 'CANCELLED');
                    toast.success(`${po.po_no} cancelled.`);
                }}
            />
        </div>
    );
}