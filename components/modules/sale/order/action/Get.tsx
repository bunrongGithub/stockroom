'use client';

import { useRegisterModule } from '@/hook/useModule';
import type { ModuleProps } from '@/lib/registry';
import { saleOrderApi, saleShipmentApi } from '@/lib/api/sale';
import { financesInvoiceApi } from '@/lib/api/finances';
import ItemClassBadge from '@/components/ui/ItemClassBadge';
import { RelatedDocumentsPanel } from '@/components/ui/RelatedDocuments';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { ReadonlyInput } from '@/components/ui/Readonly';
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
import { behaviorOf } from '@/service/core/item-behavior';
import type {
  SalesOrder,
  SalesOrderStatus,
  SalesShipment,
  SalesShipmentStatus,
} from '@/types/sales/order-management';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  ClipboardList,
  Loader2Icon,
  Package,
  PackageIcon,
  PencilIcon,
  ReceiptText,
  ReceiptTextIcon,
  TruckIcon,
  XCircleIcon,
} from 'lucide-react';

const TABS = [
  { id: 'info' as const, label: 'Details', num: 1 },
  { id: 'items' as const, label: 'Items', num: 2 },
  { id: 'related' as const, label: 'Related Documents', num: 3 },
];
type TabId = (typeof TABS)[number]['id'];

function StatusBadge({ status }: { status: SalesOrderStatus }) {
  const map: Record<SalesOrderStatus, string> = {
    open: 'bg-emerald-100 text-emerald-700',
    partial_shipment: 'bg-amber-100 text-amber-700',
    closed: 'bg-sky-100 text-sky-700',
    cancelled: 'bg-rose-100 text-rose-700',
  };
  const labels: Record<SalesOrderStatus, string> = {
    open: 'Open',
    partial_shipment: 'Partial Shipment',
    closed: 'Closed',
    cancelled: 'Cancelled',
  };
  return (
    <span
      className={`inline-block rounded-full px-3 py-1 text-xs font-mono font-semibold ${map[status]}`}
    >
      {labels[status]}
    </span>
  );
}

// Badge classes handed to the presentational RelatedDocumentsPanel.
const SHIPMENT_STATUS_BADGE: Record<SalesShipmentStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  POSTED: 'bg-emerald-100 text-emerald-700',
  VOID: 'bg-rose-100 text-rose-700',
  INVOICED: 'bg-sky-100 text-sky-700',
  PARTIALLY_INVOICED: 'bg-amber-100 text-amber-700',
};

function fmt(n: number) {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function SaleOrderDetail({
  currentPath,
  permission,
  currentPathActions,
}: ModuleProps) {
  useRegisterModule({
    actionModules: currentPathActions,
    permission,
    modulePath: currentPath.path,
  });

  const router = useRouter();
  const params = useParams();
  const id = Array.isArray(params.slug) ? (params.slug.at(-2) ?? '') : '';

  const [activeTab, setActiveTab] = useState<TabId>('info');
  const [order, setOrder] = useState<SalesOrder | null>(null);
  const [shipments, setShipments] = useState<SalesShipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{
    msg: string;
    type: 'success' | 'error';
  } | null>(null);
  const [confirmAction, setConfirmAction] = useState<'cancel' | 'close' | null>(
    null,
  );
  const [busy, setBusy] = useState(false);

  function showToast(msg: string, type: 'success' | 'error') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  async function load() {
    setLoading(true);
    try {
      const o = await saleOrderApi.get(id);
      setOrder(o);
      // Related shipments are best-effort — an order-only viewer still sees the
      // order; the shipments section stays empty rather than failing the page.
      setShipments(await saleShipmentApi.byOrder(o.id).catch(() => []));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load order');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (id) load();
  }, [id]);

  // Invoice the order's direct (non-stock/service) lines without a shipment.
  // The server copies whatever is still un-invoiced; stock lines keep
  // invoicing through their shipments.
  async function createDirectInvoice() {
    if (!order || busy) return;
    setBusy(true);
    try {
      const inv = await financesInvoiceApi.createFromOrder({
        sales_order_id: order.id,
        invoice_date: new Date().toISOString().slice(0, 10),
        currency: order.currency,
        customer_name: order.customer_name,
        customer_phone: order.customer_phone ?? undefined,
      });
      router.push(`/finances/invoice/${inv.id}/view`);
    } catch (e) {
      showToast(
        e instanceof Error ? e.message : 'Could not create invoice',
        'error',
      );
      setBusy(false);
    }
  }

  async function runAction(type: 'cancel' | 'close') {
    if (!order) return;
    setBusy(true);
    try {
      if (type === 'cancel') await saleOrderApi.cancel(order.id);
      else await saleOrderApi.close(order.id);
      showToast(
        `Order ${type === 'cancel' ? 'cancelled' : 'closed'}.`,
        'success',
      );
      await load();
    } catch (e) {
      showToast(
        e instanceof Error ? e.message : `Cannot ${type} order`,
        'error',
      );
    } finally {
      setBusy(false);
      setConfirmAction(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2Icon className="animate-spin text-emerald-500" size={28} />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <PackageIcon className="text-muted-foreground" size={40} />
        <p className="text-sm text-muted-foreground">
          {error || 'Sales order not found.'}
        </p>
        <button
          onClick={() => router.push('/sale/order')}
          className="text-xs text-sky-600 hover:underline"
        >
          Back to list
        </button>
      </div>
    );
  }

  const a = order.actions;

  // Per-channel remaining work (item-behavior): shipping only ever applies to
  // stock lines; direct lines invoice straight from the order.
  const shippableRemaining = order.items.some(
    (i) =>
      behaviorOf(i.item_class ?? 'stock').requiresShipment &&
      i.ordered_qty - i.shipped_qty > 0,
  );
  const directRemaining = order.items.some(
    (i) =>
      !behaviorOf(i.item_class ?? 'stock').requiresShipment &&
      i.ordered_qty - (i.invoiced_qty ?? 0) > 0,
  );
  const canInvoiceDirect = order.status !== 'cancelled' && directRemaining;

  return (
    <div className="space-y-4 font-mono text-xs">
      {toast && (
        <div
          className={`fixed right-4 top-4 z-50 rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}
        >
          {toast.msg}
        </div>
      )}

      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="w-80 space-y-4 rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-sm font-semibold">
              {confirmAction === 'cancel' ? 'Cancel Order' : 'Close Order'}
            </h3>
            <p className="text-xs text-muted-foreground">
              {confirmAction === 'cancel'
                ? 'Orders with posted shipments cannot be cancelled.'
                : 'Closing prevents further shipments.'}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmAction(null)}
                className="rounded-lg border px-3 py-1.5 text-xs hover:bg-muted font-mono"
              >
                Back
              </button>
              <button
                disabled={busy}
                onClick={() => runAction(confirmAction)}
                className={`rounded-lg px-3 py-1.5 text-xs text-white font-mono disabled:opacity-60 ${confirmAction === 'cancel' ? 'bg-rose-500 hover:bg-rose-600' : 'bg-slate-600 hover:bg-slate-700'}`}
              >
                {busy ? 'Working…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      <FormHeader
        backHref="/sale/order"
        backLabel="Back to Orders"
        icon={<Package />}
        title={order.order_no}
        badges={<StatusBadge status={order.status} />}
        actions={
          <>
            {a?.can_update && (
              <HeaderAction
                label="Edit"
                icon={<PencilIcon size={16} />}
                href={`/sale/order/${order.id}/update`}
              />
            )}
            {a?.can_close && (
              <HeaderAction
                label="Close"
                icon={<CheckCircleIcon size={16} />}
                onClick={() => setConfirmAction('close')}
              />
            )}
            {a?.can_cancel && (
              <HeaderAction
                label="Cancel"
                tone="danger"
                icon={<XCircleIcon size={16} />}
                onClick={() => setConfirmAction('cancel')}
              />
            )}
            {canInvoiceDirect && (
              <HeaderAction
                label={busy ? 'Creating…' : 'Create Invoice'}
                tone="info"
                icon={<ReceiptTextIcon size={16} />}
                disabled={busy}
                onClick={() => void createDirectInvoice()}
              />
            )}
            {a?.can_ship && shippableRemaining && (
              <HeaderAction
                label="Create Shipment"
                tone="primary"
                icon={<TruckIcon size={16} />}
                onClick={() => {
                  if (typeof window !== 'undefined')
                    sessionStorage.setItem(
                      'pending_dn_order_id',
                      String(order.id),
                    );
                  router.push('/sale/delivery-note/create');
                }}
              />
            )}
          </>
        }
      />

      {/* The direct-invoice caveat has no room in the header button itself. */}
      {canInvoiceDirect && shippableRemaining && (
        <p className="text-[11px] leading-snug text-slate-400">
          Create Invoice bills the non-stock / service lines now. Stock items
          are invoiced from their shipment after it posts.
        </p>
      )}

      <FormLayout
        sidebar={
          <>
            <SidebarCard icon={<ReceiptText size={13} />} title="Order Summary">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Customer</span>
                  <span className="font-semibold text-slate-700">
                    {order.customer_name}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Order Date</span>
                  <span className="font-semibold text-slate-700">
                    {order.order_date}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Warehouse</span>
                  <span className="font-semibold text-slate-700">
                    {order.warehouse_name}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Shipments</span>
                  <span className="font-semibold text-slate-700">
                    {shipments.length}
                  </span>
                </div>
                <div className="mt-2 space-y-1.5 rounded-xl bg-slate-50 p-3">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Subtotal</span>
                    <span>{fmt(order.subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Discount</span>
                    <span className="text-rose-500">
                      - {fmt(order.discount_total)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Tax</span>
                    <span>{fmt(order.tax_total)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-1.5 text-sm font-semibold">
                    <span>Grand Total</span>
                    <span>
                      {order.currency} {fmt(order.grand_total)}
                    </span>
                  </div>
                </div>
              </div>
            </SidebarCard>
            {/* Edit / Close / Cancel / Invoice / Ship live in the page header. */}
          </>
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
                  <FieldLabel>Reference No</FieldLabel>
                  <ReadonlyInput value={order.reference_no ?? ''} />
                </div>
                <div>
                  <FieldLabel>Customer</FieldLabel>
                  <ReadonlyInput value={order.customer_name} />
                </div>
                <div>
                  <FieldLabel>Phone</FieldLabel>
                  <ReadonlyInput value={order.customer_phone ?? ''} />
                </div>
                <div>
                  <FieldLabel>Order Date</FieldLabel>
                  <ReadonlyInput value={order.order_date} />
                </div>
                <div>
                  <FieldLabel>Expected Delivery</FieldLabel>
                  <ReadonlyInput value={order.expected_delivery_date ?? ''} />
                </div>
                <div>
                  <FieldLabel>Warehouse</FieldLabel>
                  <ReadonlyInput value={order.warehouse_name ?? ''} />
                </div>
                <div>
                  <FieldLabel>Currency</FieldLabel>
                  <ReadonlyInput value={order.currency} />
                </div>
                <div className="lg:col-span-2">
                  <FieldLabel>Notes</FieldLabel>
                  <ReadonlyInput value={order.notes ?? ''} />
                </div>
              </FieldGrid>
              <p className="mt-4 text-[11px] text-slate-400">
                Last updated {new Date(order.updated_at).toLocaleString()}
              </p>
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
                        <th className="text-left py-2 pr-3 font-medium">
                          Product
                        </th>
                        <th className="text-right py-2 pr-3 font-medium">
                          Ordered
                        </th>
                        <th className="text-right py-2 pr-3 font-medium">
                          Fulfilled
                        </th>
                        <th className="text-right py-2 pr-3 font-medium">
                          Remaining
                        </th>
                        <th className="text-left py-2 pr-3 font-medium">UOM</th>
                        <th className="text-right py-2 pr-3 font-medium">
                          Unit Price
                        </th>
                        <th className="text-right py-2 pr-3 font-medium">
                          Disc %
                        </th>
                        <th className="text-right py-2 pr-3 font-medium">
                          Tax %
                        </th>
                        <th className="text-right py-2 font-medium">
                          Line Total
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {order.items.map((item) => {
                        // Shippable lines fulfill by shipping; non-stock and
                        // service lines fulfill by invoicing (item-behavior).
                        const ships = behaviorOf(
                          item.item_class ?? 'stock',
                        ).requiresShipment;
                        const fulfilled = ships
                          ? item.shipped_qty
                          : (item.invoiced_qty ?? 0);
                        const remaining = item.ordered_qty - fulfilled;
                        return (
                          <tr
                            key={item.id}
                            className="border-b hover:bg-muted/20"
                          >
                            <td className="py-2 pr-3 font-medium">
                              <span className="inline-flex items-center gap-1.5">
                                {item.product_name}
                                <ItemClassBadge
                                  itemClass={item.item_class}
                                  iconOnly
                                />
                              </span>
                            </td>
                            <td className="py-2 pr-3 text-right">
                              {item.ordered_qty}
                            </td>
                            <td
                              className="py-2 pr-3 text-right font-medium text-emerald-600"
                              title={ships ? 'Shipped' : 'Invoiced'}
                            >
                              {fulfilled}
                            </td>
                            <td className="py-2 pr-3 text-right">
                              <span
                                className={
                                  remaining === 0
                                    ? 'text-slate-400'
                                    : 'text-amber-600 font-medium'
                                }
                              >
                                {remaining}
                              </span>
                            </td>
                            <td className="py-2 pr-3">{item.uom || '—'}</td>
                            <td className="py-2 pr-3 text-right">
                              {fmt(item.unit_price)}
                            </td>
                            <td className="py-2 pr-3 text-right">
                              {item.discount}%
                            </td>
                            <td className="py-2 pr-3 text-right">
                              {item.tax}%
                            </td>
                            <td className="py-2 text-right font-semibold">
                              {fmt(item.line_total)}
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
                sourceEmptyText="This sales order is the start of the document flow."
                generated={shipments.map((s) => ({
                  key: `sh-${s.id}`,
                  docType: 'Shipment',
                  number: s.shipment_no,
                  href: `/sale/delivery-note/${s.id}/view`,
                  date: s.delivery_date,
                  status: s.status.replace('_', ' '),
                  statusClass: SHIPMENT_STATUS_BADGE[s.status],
                  meta: [
                    {
                      label: 'Receiver',
                      value: s.receiver_name || '—',
                    },
                  ],
                }))}
              generatedEmptyText="No shipments have been created for this order yet."
            />
          </TabPanel>
        )}
      </FormLayout>
    </div>
  );
}
