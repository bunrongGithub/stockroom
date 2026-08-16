'use client';

import { API } from '@/lib/constant';
import { useCan } from '@/hook/useCan';
import { PERMISSIONS } from '@/service/core/authz/permissions';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { ReadonlyInput } from '@/components/ui/Readonly';
import { AuditInformationCard } from '@/components/ui/AuditInformationCard';
import type { AuditMeta } from '@/types/audit';
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
import type {
  InventoryMovemtTypeReasonMeta,
  ReceiptTxnType,
} from '@/service/apps/inventory/repo/receipt';
import {
  Ban,
  CheckCircle2,
  FileEdit,
  Loader2,
  Package,
  Send,
  Warehouse as WarehouseIcon,
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { REASON_META } from '../columns';

type ReceiptStatus = ReceiptTxnType['status'];
type ReceiptItem = NonNullable<ReceiptTxnType['items']>[number];

const TABS = [
  { id: 'info' as const, label: 'Receipt Info', num: 1 },
  { id: 'items' as const, label: 'Items', num: 2 },
];
type TabId = (typeof TABS)[number]['id'];

/**
 * One receipt line as a read-only form, mirroring the Sales Order and Stock
 * Adjustment detail dialogs so every document line reads the same way.
 */
function ReceiptLineFields({ item }: { item: ReceiptItem }) {
  const qty = Number(item.receipt_qty) || 0;
  const cost = Number(item.unit_cost) || 0;
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div>
        <FieldLabel>UOM</FieldLabel>
        <ReadonlyInput value={item.item_uom?.name ?? '—'} />
      </div>
      <div>
        <FieldLabel>Warehouse</FieldLabel>
        <ReadonlyInput value={item.warehouse?.name ?? '—'} />
      </div>
      <div>
        <FieldLabel>Location</FieldLabel>
        <ReadonlyInput value={item.location?.name ?? `#${item.location_id}`} />
      </div>
      <div>
        <FieldLabel>Receipt Qty</FieldLabel>
        <ReadonlyInput value={String(qty)} />
      </div>
      <div>
        <FieldLabel>Unit Cost</FieldLabel>
        <ReadonlyInput value={`$${cost.toFixed(2)}`} />
      </div>
      <div>
        <FieldLabel>Total Cost</FieldLabel>
        <ReadonlyInput value={`$${(qty * cost).toFixed(2)}`} />
      </div>
    </div>
  );
}

const STATUS_META: Record<
  ReceiptStatus,
  { icon: React.ReactNode; badge: string }
> = {
  DRAFT: {
    icon: <FileEdit size={13} />,
    badge: 'bg-slate-100 text-slate-600 border-slate-200',
  },
  POSTED: {
    icon: <CheckCircle2 size={13} />,
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  VOID: {
    icon: <Ban size={13} />,
    badge: 'bg-rose-50 text-rose-700 border-rose-200',
  },
};

function StatusBadge({ status }: { status: ReceiptStatus }) {
  const config = STATUS_META[status];
  if (!config) return null;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${config.badge}`}
    >
      {config.icon}
      {status}
    </span>
  );
}

function ReasonBadge({ reason }: { reason: InventoryMovemtTypeReasonMeta }) {
  const config = reason ? REASON_META[reason] : null;
  if (!config) return <ReadonlyInput value={undefined} placeholder="—" />;
  return (
    <div className="flex min-h-11.5 items-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-2">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${config.badge}`}
      >
        {config.icon}
        {config.label}
      </span>
    </div>
  );
}

export default function View({ receiptData }: { receiptData: ReceiptTxnType }) {
  const router = useRouter();
  const params = useParams();
  const id = Number(
    Array.isArray(params.slug) ? params.slug.at(-2) : params.slug,
  );

  const [receipt, setReceipt] = useState<ReceiptTxnType | null>(receiptData);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [posting, setPosting] = useState(false);
  const [voiding, setVoiding] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('info');
  /** The line the reader clicked; opens LineItemDialog in `view` mode. */
  const [detailItem, setDetailItem] = useState<ReceiptItem | null>(null);

  // Hooks must run before any early return — keep the permission checks here.
  const mayPost = useCan(PERMISSIONS.inventory.receipt.post);
  const mayVoid = useCan(PERMISSIONS.inventory.receipt.void);

  const loadReceipt = useCallback(async () => {
    if (!id) return;
    setError('');
    try {
      const res = await fetch(API.inventory.receipt.view(id));
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'Failed to load receipt.');
        return;
      }
      setReceipt(json.data as ReceiptTxnType);
    } catch {
      setError('Failed to load receipt.');
    }
  }, [id]);

  const handlePost = async () => {
    setActionError('');
    setPosting(true);
    try {
      const res = await fetch(API.inventory.receipt.post(id), {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok) {
        setActionError(json.error ?? 'Failed to post receipt.');
        return;
      }
      await loadReceipt();
      router.refresh();
    } catch {
      setActionError('An unexpected error occurred while posting.');
    } finally {
      setPosting(false);
    }
  };

  const handleVoid = async () => {
    setActionError('');
    setVoiding(true);
    try {
      const res = await fetch(API.inventory.receipt.void(id), {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok) {
        setActionError(json.error ?? 'Failed to void receipt.');
        return;
      }
      await loadReceipt();
      router.refresh();
    } catch {
      setActionError('An unexpected error occurred while voiding.');
    } finally {
      setVoiding(false);
    }
  };

  if (error) {
    return <p className="py-10 text-center text-red-500">{error}</p>;
  }

  if (!receipt) return null;

  const items = receipt.items ?? [];
  const warehouseName = items[0]?.warehouse?.name ?? '';
  const grandTotal = items.reduce(
    (sum, item) =>
      sum + (Number(item.receipt_qty) || 0) * (Number(item.unit_cost) || 0),
    0,
  );
  const canPost =
    (receipt.actions?.can_post ?? receipt.status === 'DRAFT') && mayPost;
  const canVoid =
    (receipt.actions?.can_void ?? receipt.status === 'DRAFT') && mayVoid;

  return (
    <div className="space-y-4 font-mono text-xs">
      <FormHeader
        onBackAction={() => router.back()}
        backLabel="Back"
        icon={<Package />}
        title={receipt.reference_no || 'Receipt Transaction'}
        badges={<StatusBadge status={receipt.status} />}
        subtitle={`${warehouseName || 'No warehouse'} • ${receipt.movement_type}`}
        actions={
          <>
            {canVoid && (
              <HeaderAction
                tone="danger"
                label="Void"
                icon={
                  voiding ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Ban size={16} />
                  )
                }
                disabled={voiding || posting}
                onClick={handleVoid}
              />
            )}
            {canPost && (
              <HeaderAction
                tone="primary"
                label="Post"
                icon={
                  posting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Send size={16} />
                  )
                }
                disabled={posting || voiding}
                onClick={handlePost}
              />
            )}
          </>
        }
      />

      {actionError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          {actionError}
        </div>
      )}

      <FormLayout
        sidebar={
          <>
            <SidebarCard icon={<Package size={13} />} title="Receipt Summary">
              <div className="space-y-2">
                <SummaryRow label="Reference">
                  {receipt.reference_no || '—'}
                </SummaryRow>
                <SummaryRow label="Date">{receipt.transaction_date}</SummaryRow>
                <SummaryRow label="Warehouse" title={warehouseName}>
                  {warehouseName || '—'}
                </SummaryRow>
                <SummaryRow label="Lines">{items.length}</SummaryRow>
                <SummaryRow label="Grand Total" strong>
                  ${grandTotal.toFixed(2)}
                </SummaryRow>
              </div>
            </SidebarCard>
            <AuditInformationCard audit={receipt as Partial<AuditMeta>} />
          </>
        }
      >
        <TabNav tabs={TABS} active={activeTab} onChangeAction={setActiveTab} />

        {/* Tab 1: Receipt Info */}
        {activeTab === 'info' && (
          <TabPanel>
            <SectionCard
              icon={<WarehouseIcon size={13} />}
              title="Receipt Information"
            >
              <FieldGrid>
                <div>
                  <FieldLabel>Reference No</FieldLabel>
                  <ReadonlyInput value={receipt.reference_no ?? ''} />
                </div>
                <div>
                  <FieldLabel>Supplier Ref No</FieldLabel>
                  <ReadonlyInput
                    value={receipt.source_reference_no ?? ''}
                    placeholder="—"
                  />
                </div>
                <div>
                  <FieldLabel>Warehouse</FieldLabel>
                  <ReadonlyInput value={warehouseName} placeholder="—" />
                </div>
                <div>
                  <FieldLabel>Movement Type</FieldLabel>
                  <ReadonlyInput value={receipt.movement_type} />
                </div>
                <div>
                  <FieldLabel>Transaction Date</FieldLabel>
                  <ReadonlyInput value={receipt.transaction_date} />
                </div>
                <div>
                  <FieldLabel>Reason</FieldLabel>
                  <ReasonBadge reason={receipt.reason} />
                </div>
                <div className="lg:col-span-2">
                  <FieldLabel>Additional Note</FieldLabel>
                  <ReadonlyInput value={receipt.notes ?? ''} placeholder="—" />
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
              title={`Receipt Items (${items.length})`}
            >
              {items.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">
                  No items on this receipt.
                </p>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs font-mono">
                      <thead>
                        <tr className="border-b text-muted-foreground">
                          <th className="py-2 pr-3 text-left font-medium">
                            Product
                          </th>
                          <th className="py-2 pr-3 text-left font-medium">UOM</th>
                          <th className="py-2 pr-3 text-left font-medium">
                            Location
                          </th>
                          <th className="py-2 pr-3 text-right font-medium">Qty</th>
                          <th className="py-2 pr-3 text-right font-medium">
                            Unit Cost
                          </th>
                          <th className="py-2 pr-3 text-right font-medium">
                            Total Cost
                          </th>
                          <th className="py-2 text-left font-medium">Serials</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item) => {
                          const lineTotal =
                            (Number(item.receipt_qty) || 0) *
                            (Number(item.unit_cost) || 0);
                          const serials = item.serial_numbers ?? [];
                          return (
                            <tr
                              key={item.id}
                              onClick={() => setDetailItem(item)}
                              title="View this line"
                              className="cursor-pointer border-b last:border-b-0 hover:bg-muted/30"
                            >
                              <td className="py-2 pr-3 font-medium">
                                {item.item?.name ?? `#${item.item_id}`}
                              </td>
                              <td className="py-2 pr-3">
                                {item.item_uom?.name ?? '—'}
                              </td>
                              <td className="py-2 pr-3">
                                {item.location?.name ?? `#${item.location_id}`}
                              </td>
                              <td className="py-2 pr-3 text-right">
                                {item.receipt_qty || 0}
                              </td>
                              <td className="py-2 pr-3 text-right">
                                ${Number(item.unit_cost || 0).toFixed(2)}
                              </td>
                              <td className="py-2 pr-3 text-right font-semibold">
                                ${lineTotal.toFixed(2)}
                              </td>
                              <td className="py-2 text-muted-foreground">
                                {serials.length || '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4 flex justify-end">
                    <div className="w-56">
                      <div className="flex justify-between border-t pt-1.5 text-sm font-semibold">
                        <span>Grand Total</span>
                        <span>${grandTotal.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
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
          title={detailItem.item?.name ?? `#${detailItem.item_id}`}
          context={
            <>
              <LineDialogFact
                icon={<Package className="text-emerald-600" size={13} />}
              >
                Qty {detailItem.receipt_qty || 0} · Unit cost $
                {Number(detailItem.unit_cost || 0).toFixed(2)}
              </LineDialogFact>
              <LineDialogFact
                icon={<WarehouseIcon className="text-emerald-600" size={13} />}
              >
                {detailItem.warehouse?.name ?? warehouseName} ·{' '}
                {detailItem.location?.name ?? `#${detailItem.location_id}`}
              </LineDialogFact>
            </>
          }
          tabs={
            (detailItem.serial_numbers ?? []).length > 0
              ? [
                  {
                    id: 'details',
                    label: 'Item Details',
                    content: <ReceiptLineFields item={detailItem} />,
                  },
                  {
                    id: 'serials',
                    label: 'Serials',
                    badge: (detailItem.serial_numbers ?? []).length,
                    content: (
                      <SerialLookupPanel
                        readOnly
                        itemId={detailItem.item_id}
                        warehouseId={detailItem.warehouse_id}
                        locationId={detailItem.location_id}
                        requiredCount={(detailItem.serial_numbers ?? []).length}
                        value={detailItem.serial_numbers ?? []}
                        onChange={() => {}}
                      />
                    ),
                  },
                ]
              : undefined
          }
        >
          <ReceiptLineFields item={detailItem} />
        </LineItemDialog>
      )}
    </div>
  );
}
