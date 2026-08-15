'use client';

import { useRegisterModule } from '@/hook/useModule';
import { useCan } from '@/hook/useCan';
import { PERMISSIONS } from '@/service/core/authz/permissions';
import type { ModuleProps } from '@/lib/registry';
import {saleOrderApi, saleShipmentApi } from '@/lib/api/sale';
import { financesInvoiceApi } from '@/lib/api/finances';
import { RelatedDocumentsPanel } from '@/components/ui/RelatedDocuments';
import { AuditInformationCard } from '@/components/ui/AuditInformationCard';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { ReadonlyInput } from '@/components/ui/Readonly';
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
import type { AuditMeta } from '@/types/audit';
import type {
  SalesInvoice,
  SalesInvoiceStatus,
  SalesOrder,
  SalesOrderStatus,
  SalesShipment,
  SalesShipmentStatus,
} from '@/types/sales/order-management';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeftIcon,
  Ban,
  FileText,
  Loader2Icon,
  Package,
  PackageIcon,
  PencilIcon,
  SendIcon,
  Truck,
} from 'lucide-react';

const TABS = [
  { id: 'details' as const, label: 'Details', num: 1 },
  { id: 'items' as const, label: 'Items', num: 2 },
  { id: 'related' as const, label: 'Related Documents', num: 3 },
];

function money(n: number) {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Badge classes handed to the presentational RelatedDocumentsPanel.
const ORDER_STATUS_BADGE: Record<SalesOrderStatus, string> = {
  open: 'bg-emerald-100 text-emerald-700',
  partial_shipment: 'bg-amber-100 text-amber-700',
  closed: 'bg-sky-100 text-sky-700',
  cancelled: 'bg-rose-100 text-rose-700',
};
const INVOICE_STATUS_BADGE: Record<SalesInvoiceStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  POSTED: 'bg-emerald-100 text-emerald-700',
  CANCELLED: 'bg-rose-100 text-rose-700',
};
type TabId = (typeof TABS)[number]['id'];

function StatusBadge({ status }: { status: SalesShipmentStatus }) {
  const map: Record<SalesShipmentStatus, string> = {
    DRAFT: 'bg-gray-100 text-gray-600',
    POSTED: 'bg-emerald-100 text-emerald-700',
    VOID: 'bg-rose-100 text-rose-700',
    INVOICED: 'bg-sky-100 text-sky-700',
    PARTIALLY_INVOICED: 'bg-amber-100 text-amber-700',
  };
  return (
    <span
      className={`inline-block rounded-full px-3 py-1 text-xs font-mono font-semibold ${map[status]}`}
    >
      {status}
    </span>
  );
}

export default function SaleShipmentDetail({
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

  const [activeTab, setActiveTab] = useState<TabId>('details');
  const [shipment, setShipment] = useState<SalesShipment | null>(null);
  const [order, setOrder] = useState<SalesOrder | null>(null);
  const [invoices, setInvoices] = useState<SalesInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{
    msg: string;
    type: 'success' | 'error';
  } | null>(null);
  const [busy, setBusy] = useState<'post' | 'void' | null>(null);

  // UX gating; server enforces. Show only if status allows AND user is granted.
  const mayPost = useCan(PERMISSIONS.sales.shipment.post);
  const mayVoid = useCan(PERMISSIONS.sales.shipment.void);

  function showToast(msg: string, type: 'success' | 'error') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }

  async function load() {
    setLoading(true);
    try {
      const s = await saleShipmentApi.get(id);
      setShipment(s);
      // Related documents are best-effort: a user allowed to see shipments but
      // not invoices/orders still gets the shipment — those sections just stay
      // empty instead of failing the whole page (or firing a 403 toast).
      setInvoices(await financesInvoiceApi.byShipment(s.id).catch(() => []));
      if (s.sales_order_id) {
        setOrder(await saleOrderApi.get(s.sales_order_id).catch(() => null));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load shipment');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (id) load();
  }, [id]);

  async function handlePost() {
    if (!shipment) return;
    setBusy('post');
    try {
      await saleShipmentApi.post(shipment.id);
      showToast('Shipment posted — stock updated.', 'success');
      await load();
    } catch (e) {
      showToast(
        e instanceof Error ? e.message : 'Failed to post shipment',
        'error',
      );
    } finally {
      setBusy(null);
    }
  }

  async function handleVoid() {
    if (!shipment) return;
    setBusy('void');
    try {
      await saleShipmentApi.void(shipment.id);
      showToast('Shipment voided.', 'success');
      await load();
    } catch (e) {
      showToast(
        e instanceof Error ? e.message : 'Failed to void shipment',
        'error',
      );
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2Icon className="animate-spin text-emerald-500" size={28} />
      </div>
    );
  }

  if (error || !shipment) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <PackageIcon className="text-muted-foreground" size={40} />
        <p className="text-sm text-muted-foreground">
          {error || 'Shipment not found.'}
        </p>
        <button
          onClick={() => router.push('/sale/delivery-note')}
          className="text-xs text-sky-600 hover:underline"
        >
          Back to list
        </button>
      </div>
    );
  }

  const a = shipment.actions;

  return (
    <div className="space-y-4 font-mono text-xs">
      {toast && (
        <div
          className={`fixed right-4 top-4 z-50 rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}
        >
          {toast.msg}
        </div>
      )}

      <FormHeader
        backHref="/sale/delivery-note"
        backLabel="Back"
        icon={<Truck />}
        title={shipment.shipment_no}
        badges={<StatusBadge status={shipment.status} />}
        actions={
          <>
            {a?.can_update && (
              <HeaderAction
                label="Edit"
                icon={<PencilIcon size={16} />}
                href={`/sale/delivery-note/${shipment.id}/update`}
              />
            )}
            {a?.can_void && mayVoid && (
              <HeaderAction
                label="Void"
                tone="danger"
                icon={
                  busy === 'void' ? (
                    <Loader2Icon size={16} className="animate-spin" />
                  ) : (
                    <Ban size={16} />
                  )
                }
                disabled={busy !== null}
                onClick={handleVoid}
              />
            )}
            {a?.can_invoice && (
              <HeaderAction
                label="Create Invoice"
                tone="info"
                icon={<FileText size={16} />}
                onClick={() => {
                  if (typeof window !== 'undefined')
                    sessionStorage.setItem(
                      'pending_invoice_shipment_id',
                      String(shipment.id),
                    );
                  router.push('/finances/invoice/create');
                }}
              />
            )}
            {a?.can_post && mayPost && (
              <HeaderAction
                label="Post"
                tone="primary"
                icon={
                  busy === 'post' ? (
                    <Loader2Icon size={16} className="animate-spin" />
                  ) : (
                    <SendIcon size={16} />
                  )
                }
                disabled={busy !== null}
                onClick={handlePost}
              />
            )}
          </>
        }
      />

      <FormLayout
        sidebar={
          <>
            <SidebarCard icon={<Truck size={13} />} title="Delivery Summary">
              <div className="space-y-2">
                <SummaryRow label="Order">
                  <button
                    onClick={() =>
                      router.push(`/sale/order/${shipment.sales_order_id}/view`)
                    }
                    className="max-w-full truncate text-sky-600 hover:underline"
                  >
                    {shipment.sales_order_no}
                  </button>
                </SummaryRow>
                <SummaryRow label="Customer">
                  {shipment.customer_name || '—'}
                </SummaryRow>
                <SummaryRow label="Delivery Date">
                  {shipment.delivery_date}
                </SummaryRow>
                <SummaryRow label="Warehouse" title={shipment.warehouse_name}>
                  {shipment.warehouse_name}
                </SummaryRow>
              </div>
            </SidebarCard>
            {/* Edit / Void / Post / Create Invoice live in the page header. */}
            <AuditInformationCard audit={shipment as Partial<AuditMeta>} />
          </>
        }
      >
        <TabNav tabs={TABS} active={activeTab} onChangeAction={setActiveTab} />

        {/* Tab 1: Details */}
        {activeTab === 'details' && (
          <TabPanel>
            <SectionCard
              icon={<Truck size={13} />}
              title="Delivery Information"
            >
              <FieldGrid>
                <div>
                  <FieldLabel>Reference No</FieldLabel>
                  <ReadonlyInput value={shipment.reference_no ?? ''} />
                </div>
                <div>
                  <FieldLabel>Customer</FieldLabel>
                  <ReadonlyInput value={shipment.customer_name ?? ''} />
                </div>
                <div>
                  <FieldLabel>Customer Phone</FieldLabel>
                  <ReadonlyInput value={shipment.customer_phone ?? ''} />
                </div>
                <div>
                  <FieldLabel>Delivery Date</FieldLabel>
                  <ReadonlyInput value={shipment.delivery_date} />
                </div>
                <div>
                  <FieldLabel>Warehouse</FieldLabel>
                  <ReadonlyInput value={shipment.warehouse_name ?? ''} />
                </div>
                <div>
                  <FieldLabel>Receiver</FieldLabel>
                  <ReadonlyInput value={shipment.receiver_name ?? ''} />
                </div>
                <div className="lg:col-span-2">
                  <FieldLabel>Address</FieldLabel>
                  <ReadonlyInput value={shipment.delivery_address ?? ''} />
                </div>
                <div className="lg:col-span-2">
                  <FieldLabel>Notes</FieldLabel>
                  <ReadonlyInput value={shipment.notes ?? ''} />
                </div>
              </FieldGrid>
              <p className="mt-4 text-[11px] text-slate-400">
                Last updated {new Date(shipment.updated_at).toLocaleString()}
              </p>
            </SectionCard>
          </TabPanel>
        )}

        {/* Tab 2: Shipment Items */}
        {activeTab === 'items' && (
          <TabPanel>
            <SectionCard icon={<Package size={13} />} title="Delivery Items">
              <div className="overflow-x-auto">
                  <table className="w-full text-xs font-mono">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="text-left py-2 pr-3 font-medium">
                          Product
                        </th>
                        <th className="text-left py-2 pr-3 font-medium">
                          Location
                        </th>
                        <th className="text-left py-2 pr-3 font-medium">UOM</th>
                        <th className="text-right py-2 pr-3 font-medium">
                          Ordered
                        </th>
                        <th className="text-right py-2 pr-3 font-medium">
                          Prev. Shipped
                        </th>
                        <th className="text-right py-2 pr-3 font-medium">
                          Shipment Qty
                        </th>
                        <th className="text-left py-2 font-medium">Serials</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shipment.items.map((item) => (
                        <tr
                          key={item.id}
                          className="border-b hover:bg-muted/20"
                        >
                          <td className="py-2 pr-3 font-medium">
                            {item.product_name}
                          </td>
                          <td className="py-2 pr-3">
                            {item.location_name || '—'}
                          </td>
                          <td className="py-2 pr-3">{item.uom || '—'}</td>
                          <td className="py-2 pr-3 text-right">
                            {item.ordered_qty}
                          </td>
                          <td className="py-2 pr-3 text-right">
                            {item.previously_shipped_qty}
                          </td>
                          <td className="py-2 pr-3 text-right font-semibold text-emerald-600">
                            {item.shipment_qty}
                          </td>
                          <td className="py-2 text-slate-500">
                            {item.serial_numbers?.length
                              ? item.serial_numbers.join(', ')
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

        {/* Tab 3: Related Documents (document flow) */}
        {activeTab === 'related' && (
          <TabPanel>
            {(() => {
                const shippedTotal = shipment.items.reduce(
                  (s, i) => s + i.shipment_qty,
                  0,
                );
                const invoicedTotal = invoices
                  .filter((iv) => iv.status !== 'CANCELLED')
                  .reduce((s, iv) => s + iv.total_quantity, 0);
                const remaining = shippedTotal - invoicedTotal;
                return (
                  <RelatedDocumentsPanel
                    source={
                      order
                        ? [
                            {
                              key: `so-${order.id}`,
                              docType: 'Sales Order',
                              number: order.order_no,
                              href: `/sale/order/${order.id}/view`,
                              date: order.order_date,
                              status: order.status.replace('_', ' ').toLocaleUpperCase(),
                              statusClass: ORDER_STATUS_BADGE[order.status],
                              meta: [
                                {
                                  label: 'Customer',
                                  value: order.customer_name,
                                },
                                {
                                  label: 'Qty',
                                  value: String(
                                    order.items.reduce(
                                      (s, i) => s + i.ordered_qty,
                                      0,
                                    ),
                                  ),
                                },
                                {
                                  label: 'Total',
                                  value: `${order.currency} ${money(order.grand_total)}`,
                                },
                              ],
                            },
                          ]
                        : []
                    }
                    generated={invoices.map((iv) => ({
                      key: `inv-${iv.id}`,
                      docType: 'Invoice',
                      number: iv.invoice_no,
                      href: `/finances/invoice/${iv.id}/view`,
                      date: iv.invoice_date,
                      status: iv.status,
                      statusClass: INVOICE_STATUS_BADGE[iv.status],
                      meta: [
                        {
                          label: 'Qty',
                          value: String(iv.total_quantity),
                        },
                        {
                          label: 'Total',
                          value: `${iv.currency} ${money(iv.grand_total)}`,
                        },
                      ],
                    }))}
                    generatedEmptyText="No invoices created for this shipment yet."
                    summary={
                      <div className="flex flex-wrap gap-4 rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5">
                        <span className="text-slate-400">
                          Shipped{' '}
                          <span className="font-semibold text-slate-700">
                            {shippedTotal}
                          </span>
                        </span>
                        <span className="text-emerald-600">
                          Invoiced{' '}
                          <span className="font-semibold">{invoicedTotal}</span>
                        </span>
                        <span
                          className={
                            remaining > 0 ? 'text-amber-600' : 'text-slate-400'
                          }
                        >
                          Remaining{' '}
                          <span className="font-semibold">{remaining}</span>
                        </span>
                      </div>
                    }
                  />
                );
            })()}
          </TabPanel>
        )}
      </FormLayout>
    </div>
  );
}
