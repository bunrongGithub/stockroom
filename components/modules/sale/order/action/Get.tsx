'use client';

import { useRegisterModule } from '@/hook/useModule';
import type { ModuleProps } from '@/lib/registry';
import { saleOrderApi, saleShipmentApi } from '@/lib/api/sale';
import { RelatedDocumentsPanel } from '@/components/ui/RelatedDocuments';
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
  Loader2Icon,
  Package,
  PackageIcon,
  PencilIcon,
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

      <div>
        <button
          onClick={() => router.push('/sale/order')}
          className="inline-flex items-center gap-2 text-slate-500 transition-colors hover:text-slate-700"
        >
          <ArrowLeftIcon size={16} /> Back to Orders
        </button>
        <h2 className="mt-3 flex items-center gap-3 text-2xl font-bold text-slate-800 md:text-3xl">
          <Package className="text-[#1a9e52]" />
          {order.order_no}
          <StatusBadge status={order.status} />
        </h2>
      </div>

      <div className="grid gap-6 xl:grid-cols-[350px_minmax(0,1fr)]">
        {/* LEFT SIDEBAR — order summary + actions */}
        <aside className="space-y-4 self-start xl:sticky xl:top-6">
          <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            <div className="border-b border-slate-50 bg-slate-50/80 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Order Summary
            </div>
            <div className="space-y-2 p-4">
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
          </section>

          {(a?.can_update || a?.can_ship || a?.can_close || a?.can_cancel) && (
            <div className="flex flex-col gap-2">
              {a?.can_update && (
                <button
                  onClick={() => router.push(`/sale/order/${order.id}/update`)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-violet-200 px-4 py-2.5 text-violet-600 transition-colors hover:bg-violet-50"
                >
                  <PencilIcon size={14} /> Edit
                </button>
              )}
              {a?.can_ship && (
                <button
                  onClick={() => {
                    if (typeof window !== 'undefined')
                      sessionStorage.setItem(
                        'pending_dn_order_id',
                        String(order.id),
                      );
                    router.push('/sale/delivery-note/create');
                  }}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1a9e52] px-4 py-2.5 font-semibold text-white transition-colors hover:bg-[#158042]"
                >
                  <TruckIcon size={14} /> Create Shipment
                </button>
              )}
              {a?.can_close && (
                <button
                  onClick={() => setConfirmAction('close')}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-slate-600 transition-colors hover:bg-slate-50"
                >
                  <CheckCircleIcon size={14} /> Close
                </button>
              )}
              {a?.can_cancel && (
                <button
                  onClick={() => setConfirmAction('cancel')}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 px-4 py-2.5 text-rose-600 transition-colors hover:bg-rose-50"
                >
                  <XCircleIcon size={14} /> Cancel
                </button>
              )}
            </div>
          )}
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
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab 1: Order Information */}
          {activeTab === 'info' && (
            <div className="space-y-5 pt-5">
              <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                  Order Information
                </h3>
                <div className="grid grid-cols-2 gap-y-3 lg:grid-cols-4">
                  <span className="text-slate-400">Reference No</span>
                  <span>{order.reference_no || '—'}</span>
                  <span className="text-slate-400">Customer</span>
                  <span className="font-medium">{order.customer_name}</span>
                  <span className="text-slate-400">Phone</span>
                  <span>{order.customer_phone || '—'}</span>
                  <span className="text-slate-400">Order Date</span>
                  <span>{order.order_date}</span>
                  <span className="text-slate-400">Expected Delivery</span>
                  <span>{order.expected_delivery_date || '—'}</span>
                  <span className="text-slate-400">Warehouse</span>
                  <span>{order.warehouse_name}</span>
                  <span className="text-slate-400">Currency</span>
                  <span>{order.currency}</span>
                  {order.notes && (
                    <>
                      <span className="text-slate-400">Notes</span>
                      <span>{order.notes}</span>
                    </>
                  )}
                </div>
                <p className="mt-4 text-[11px] text-slate-400">
                  Last updated {new Date(order.updated_at).toLocaleString()}
                </p>
              </section>
            </div>
          )}

          {/* Tab 2: Order Items */}
          {activeTab === 'items' && (
            <div className="space-y-5 pt-5">
              <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                  Order Items
                </h3>
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
                          Shipped
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
                        const remaining = item.ordered_qty - item.shipped_qty;
                        return (
                          <tr
                            key={item.id}
                            className="border-b hover:bg-muted/20"
                          >
                            <td className="py-2 pr-3 font-medium">
                              {item.product_name}
                            </td>
                            <td className="py-2 pr-3 text-right">
                              {item.ordered_qty}
                            </td>
                            <td className="py-2 pr-3 text-right font-medium text-emerald-600">
                              {item.shipped_qty}
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
              </section>
            </div>
          )}

          {/* Tab 3: Related Documents (document flow) */}
          {activeTab === 'related' && (
            <div className="space-y-5 pt-5">
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
