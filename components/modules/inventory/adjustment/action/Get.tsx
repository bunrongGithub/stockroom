'use client';

import { useRegisterModule } from '@/hook/useModule';
import type { ModuleProps } from '@/lib/registry';
import { stockAdjustmentApi } from '@/lib/api/adjustment';
import type {
    StockAdjustment,
    StockAdjustmentItem,
    StockAdjustmentStatus,
} from '@/types/inventory/adjustment';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    ArrowLeftRight,
    Ban,
    FileWarning,
    Loader2Icon,
    Package,
    PencilIcon,
    SendIcon,
    Warehouse,
} from 'lucide-react';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { ReadonlyInput } from '@/components/ui/Readonly';
import { AuditInformationCard } from '@/components/ui/AuditInformationCard';
import {
    FieldGrid,
    FormHeader,
    FormLayout,
    HeaderAction,
    SectionCard,
    SidebarCard,
    SummaryRow,
    TabNav,
    TabPanel,
} from '@/components/ui/FormShell';
import {
    LineDialogFact,
    LineItemDialog,
} from '@/components/ui/LineItemDialog';
import SerialLookupPanel from '@/components/ui/serial/SerialLookupPanel';
import type { AuditMeta } from '@/types/audit';

const TABS = [
    { id: 'info' as const, label: 'Adjust Info', num: 1 },
    { id: 'items' as const, label: 'Items', num: 2 },
];
type TabId = (typeof TABS)[number]['id'];

/**
 * One adjustment line as a read-only form — the same shape the Sales Order and
 * Delivery Note detail pages use, so a document line reads identically wherever
 * you meet it.
 */
function AdjustLineFields({ item }: { item: StockAdjustmentItem }) {
    return (
        <div className="grid gap-4 sm:grid-cols-3">
            <div>
                <FieldLabel>SKU</FieldLabel>
                <ReadonlyInput value={item.sku || '—'} />
            </div>
            <div>
                <FieldLabel>UOM</FieldLabel>
                <ReadonlyInput value={item.uom || '—'} />
            </div>
            <div>
                <FieldLabel>Unit Cost</FieldLabel>
                <ReadonlyInput
                    value={item.unit_cost != null ? String(item.unit_cost) : '—'}
                />
            </div>
            <div>
                <FieldLabel>Current Qty</FieldLabel>
                <ReadonlyInput value={String(item.current_qty)} />
            </div>
            <div>
                <FieldLabel>Adjustment</FieldLabel>
                <ReadonlyInput
                    value={
                        item.adjustment_qty > 0
                            ? `+${item.adjustment_qty}`
                            : String(item.adjustment_qty)
                    }
                />
            </div>
            <div>
                <FieldLabel>New Qty</FieldLabel>
                <ReadonlyInput value={String(item.new_qty)} />
            </div>
            <div className="sm:col-span-3">
                <FieldLabel>Remarks</FieldLabel>
                <ReadonlyInput value={item.remarks || '—'} />
            </div>
        </div>
    );
}

function StatusBadge({ status }: { status: StockAdjustmentStatus }) {
    const map: Record<StockAdjustmentStatus, string> = {
        DRAFT: 'bg-gray-100 text-gray-600',
        POSTED: 'bg-emerald-100 text-emerald-800',
        VOID: 'bg-rose-100 text-rose-800',
    };
    return (
        <span
            className={`inline-block rounded-full px-2.5 py-1 text-xs font-mono font-medium ${map[status]}`}
        >
            {status}
        </span>
    );
}

// Registered as `InventoryStockAdjDetail`.
export default function InventoryStockAdjDetail({
    currentPath,
    permission,
    currentPathActions,
}: ModuleProps) {
    useRegisterModule({
        actionModules: currentPathActions,
        permission,
        modulePath: currentPath.path,
    });

    const params = useParams();
    const router = useRouter();
    const id = Number(Array.isArray(params.slug) ? params.slug.at(-2) : '');

    const [adjustment, setAdjustment] = useState<StockAdjustment | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [actionError, setActionError] = useState('');
    const [confirmPost, setConfirmPost] = useState(false);
    const [activeTab, setActiveTab] = useState<TabId>('info');
    /** The line the reader clicked; opens LineItemDialog in `view` mode. */
    const [detailItem, setDetailItem] = useState<StockAdjustmentItem | null>(null);

    async function load() {
        try {
            setAdjustment(await stockAdjustmentApi.get(id));
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load adjustment');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (id) load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    async function act(kind: 'post' | 'void') {
        setActionError('');
        setBusy(true);
        try {
            if (kind === 'post') await stockAdjustmentApi.post(id);
            else await stockAdjustmentApi.void(id);
            setConfirmPost(false);
            await load();
            router.refresh();
        } catch (e) {
            setActionError(
                e instanceof Error ? e.message : `Cannot ${kind} adjustment`,
            );
            setConfirmPost(false);
        } finally {
            setBusy(false);
        }
    }

    if (loading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loader2Icon className="animate-spin text-emerald-500" size={26} />
            </div>
        );
    }

    if (error || !adjustment) {
        return (
            <div className="flex h-64 flex-col items-center justify-center gap-3">
                <FileWarning className="text-muted-foreground" size={40} />
                <p className="text-sm text-muted-foreground">
                    {error || 'Adjustment not found.'}
                </p>
                <button
                    onClick={() => router.push('/inventory/stock_adjust')}
                    className="text-xs text-sky-600 hover:underline"
                >
                    Back to list
                </button>
            </div>
        );
    }

    const a = adjustment.actions;

    return (
        <div className="space-y-5 font-mono text-xs">
            {/* Post confirmation */}
            {confirmPost && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
                    <div className="w-96 space-y-4 rounded-2xl bg-white p-6 shadow-xl">
                        <h3 className="text-sm font-semibold">Post Adjustment</h3>
                        <p className="text-xs text-muted-foreground">
                            Post {adjustment.adjustment_no}?{' '}
                            <span className="text-emerald-600 font-semibold">
                                +{adjustment.total_in} IN
                            </span>{' '}
                            ·{' '}
                            <span className="text-rose-600 font-semibold">
                                −{adjustment.total_out} OUT
                            </span>
                            <br />
                            Inventory movements are created, stock balances update,
                            serial numbers change status, and the document locks.
                        </p>
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setConfirmPost(false)}
                                className="rounded-lg border px-3 py-1.5 text-xs hover:bg-muted"
                            >
                                Back
                            </button>
                            <button
                                disabled={busy}
                                onClick={() => act('post')}
                                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs text-white hover:bg-emerald-700 disabled:opacity-60"
                            >
                                {busy ? 'Posting…' : 'Confirm Post'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <FormHeader
                onBackAction={() => router.push('/inventory/stock_adjust')}
                backLabel="Back"
                icon={<ArrowLeftRight />}
                title={adjustment.adjustment_no}
                badges={<StatusBadge status={adjustment.status} />}
                subtitle={`${adjustment.warehouse_name} • ${adjustment.reason_label}`}
                actions={
                    <>
                        {a?.can_update && (
                            <HeaderAction
                                tone="info"
                                label="Edit"
                                icon={<PencilIcon size={16} />}
                                href={`/inventory/stock_adjust/${adjustment.id}/update`}
                            />
                        )}
                        {a?.can_post && (
                            <HeaderAction
                                tone="primary"
                                label="Post"
                                icon={<SendIcon size={16} />}
                                disabled={busy}
                                onClick={() => setConfirmPost(true)}
                            />
                        )}
                        {a?.can_void && (
                            <HeaderAction
                                tone="danger"
                                label="Void"
                                icon={
                                    busy ? (
                                        <Loader2Icon className="animate-spin" size={16} />
                                    ) : (
                                        <Ban size={16} />
                                    )
                                }
                                disabled={busy}
                                onClick={() => act('void')}
                            />
                        )}
                    </>
                }
            />

            {actionError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700">
                    {actionError}
                </div>
            )}

            <FormLayout
                sidebar={
                    <>
                        <SidebarCard
                            icon={<ArrowLeftRight size={13} />}
                            title="Adjustment Summary"
                        >
                            <div className="space-y-2">
                                <SummaryRow label="Reference">
                                    {adjustment.reference_no || '—'}
                                </SummaryRow>
                                <SummaryRow label="Date">
                                    {adjustment.adjustment_date}
                                </SummaryRow>
                                <SummaryRow
                                    label="Warehouse"
                                    title={adjustment.warehouse_name}
                                >
                                    {adjustment.warehouse_name}
                                </SummaryRow>
                                <SummaryRow label="Lines">
                                    {adjustment.items.length}
                                </SummaryRow>
                                <SummaryRow label="Net" strong>
                                    <span className="text-emerald-600">
                                        +{adjustment.total_in}
                                    </span>{' '}
                                    ·{' '}
                                    <span className="text-rose-600">
                                        −{adjustment.total_out}
                                    </span>
                                </SummaryRow>
                            </div>
                        </SidebarCard>
                        <AuditInformationCard
                            audit={adjustment as Partial<AuditMeta>}
                        />
                    </>
                }
            >
                <TabNav tabs={TABS} active={activeTab} onChangeAction={setActiveTab} />

                {/* Tab 1: Adjust Info */}
                {activeTab === 'info' && (
                    <TabPanel>
                        <SectionCard
                            icon={<Warehouse size={13} />}
                            title="Adjustment Information"
                        >
                            <FieldGrid>
                                <div>
                                    <FieldLabel>Reference No</FieldLabel>
                                    <ReadonlyInput
                                        value={adjustment.reference_no || '—'}
                                    />
                                </div>
                                <div>
                                    <FieldLabel>Date</FieldLabel>
                                    <ReadonlyInput value={adjustment.adjustment_date} />
                                </div>
                                <div>
                                    <FieldLabel>Warehouse</FieldLabel>
                                    <ReadonlyInput value={adjustment.warehouse_name} />
                                </div>
                                <div>
                                    <FieldLabel>Location</FieldLabel>
                                    <ReadonlyInput value={adjustment.location_name} />
                                </div>
                                <div>
                                    <FieldLabel>Reason</FieldLabel>
                                    <ReadonlyInput value={adjustment.reason_label} />
                                </div>
                                <div>
                                    <FieldLabel>Posted At</FieldLabel>
                                    <ReadonlyInput
                                        value={
                                            adjustment.posted_at
                                                ? new Date(
                                                      adjustment.posted_at,
                                                  ).toLocaleString()
                                                : '—'
                                        }
                                    />
                                </div>
                                <div className="lg:col-span-2">
                                    <FieldLabel>Remarks</FieldLabel>
                                    <ReadonlyInput value={adjustment.remarks || '—'} />
                                </div>
                            </FieldGrid>
                        </SectionCard>
                    </TabPanel>
                )}

                {/* Tab 2: Items */}
                {activeTab === 'items' && (
                    <TabPanel>
                        <SectionCard
                            icon={<Package size={13} />}
                            title={`Items (${adjustment.items.length})`}
                        >
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs font-mono tabular-nums">
                                    <thead>
                                        <tr className="border-b text-muted-foreground">
                                            <th className="py-2 pr-3 text-left font-medium">
                                                Item
                                            </th>
                                            <th className="py-2 pr-3 text-left font-medium">
                                                SKU
                                            </th>
                                            <th className="py-2 pr-3 text-right font-medium">
                                                Current
                                            </th>
                                            <th className="py-2 pr-3 text-right font-medium">
                                                Adjustment
                                            </th>
                                            <th className="py-2 pr-3 text-right font-medium">
                                                New Qty
                                            </th>
                                            <th className="py-2 pr-3 text-left font-medium">
                                                UOM
                                            </th>
                                            <th className="py-2 text-left font-medium">
                                                Serials
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {adjustment.items.map((item) => (
                                            <tr
                                                key={item.id}
                                                onClick={() => setDetailItem(item)}
                                                title="View this line"
                                                className="cursor-pointer border-b last:border-b-0 hover:bg-muted/30"
                                            >
                                                <td className="py-2 pr-3 font-medium">
                                                    {item.product_name}
                                                </td>
                                                <td className="py-2 pr-3 text-muted-foreground">
                                                    {item.sku || '—'}
                                                </td>
                                                <td className="py-2 pr-3 text-right text-muted-foreground">
                                                    {item.current_qty}
                                                </td>
                                                <td
                                                    className={`py-2 pr-3 text-right font-semibold ${
                                                        item.adjustment_qty > 0
                                                            ? 'text-emerald-600'
                                                            : 'text-rose-600'
                                                    }`}
                                                >
                                                    {item.adjustment_qty > 0
                                                        ? `+${item.adjustment_qty}`
                                                        : item.adjustment_qty}
                                                </td>
                                                <td className="py-2 pr-3 text-right font-semibold">
                                                    {item.new_qty}
                                                </td>
                                                <td className="py-2 pr-3">
                                                    {item.uom || '—'}
                                                </td>
                                                <td className="py-2 text-muted-foreground">
                                                    {item.track_serial
                                                        ? item.serial_numbers.length
                                                        : '—'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </SectionCard>
                    </TabPanel>
                )}
            </FormLayout>

            {/* ── Line detail (read-only) ── */}
            {detailItem && (
                <LineItemDialog
                    open
                    onOpenChange={(o) => !o && setDetailItem(null)}
                    mode="view"
                    title={
                        detailItem.sku
                            ? `${detailItem.sku}~${detailItem.product_name}`
                            : detailItem.product_name
                    }
                    context={
                        <>
                            <LineDialogFact
                                icon={<Package className="text-emerald-600" size={13} />}
                            >
                                Current {detailItem.current_qty} · Adjustment{' '}
                                {detailItem.adjustment_qty > 0
                                    ? `+${detailItem.adjustment_qty}`
                                    : detailItem.adjustment_qty}{' '}
                                · New {detailItem.new_qty}
                            </LineDialogFact>
                            <LineDialogFact
                                icon={<Warehouse className="text-emerald-600" size={13} />}
                            >
                                {adjustment.warehouse_name} · {adjustment.location_name}
                            </LineDialogFact>
                        </>
                    }
                    tabs={
                        detailItem.track_serial
                            ? [
                                  {
                                      id: 'details',
                                      label: 'Item Details',
                                      content: <AdjustLineFields item={detailItem} />,
                                  },
                                  {
                                      id: 'serials',
                                      label: 'Serials',
                                      badge: detailItem.serial_numbers.length,
                                      content: (
                                          <SerialLookupPanel
                                              readOnly
                                              itemId={detailItem.item_id}
                                              warehouseId={adjustment.warehouse_id}
                                              locationId={adjustment.location_id}
                                              requiredCount={
                                                  detailItem.serial_numbers.length
                                              }
                                              value={detailItem.serial_numbers}
                                              onChange={() => {}}
                                          />
                                      ),
                                  },
                              ]
                            : undefined
                    }
                >
                    <AdjustLineFields item={detailItem} />
                </LineItemDialog>
            )}
        </div>
    );
}
