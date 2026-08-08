'use client';

import { useRegisterModule } from '@/hook/useModule';
import { useCan } from '@/hook/useCan';
import { PERMISSIONS } from '@/service/core/authz/permissions';
import type { ModuleProps } from '@/lib/registry';
import { financesInvoiceApi } from '@/lib/api/finances';
import { RelatedDocumentsPanel } from '@/components/ui/RelatedDocuments';
import { AuditInformationCard } from '@/components/ui/AuditInformationCard';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { ReadonlyInput } from '@/components/ui/Readonly';
import {
  FieldGrid,
  FormLayout,
  SectionCard,
  SidebarCard,
  TabNav,
  TabPanel,
} from '@/components/ui/FormShell';
import type { AuditMeta } from '@/types/audit';
import type {
  SalesInvoice,
  SalesInvoiceStatus,
} from '@/types/sales/order-management';
import type { InvoicePaymentRef } from '@/types/sales/payment';
import PaymentStatusBadge from '../PaymentStatusBadge';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeftIcon,
  Ban,
  FileText,
  FileWarning,
  Loader2Icon,
  Package,
  PencilIcon,
  PrinterIcon,
  ReceiptText,
  SendIcon,
  Trash2Icon,
  WalletIcon,
} from 'lucide-react';

const TABS = [
  { id: 'info' as const, label: 'Invoice Information', num: 1 },
  { id: 'items' as const, label: 'Items', num: 2 },
  { id: 'related' as const, label: 'Related Documents', num: 3 },
];
type TabId = (typeof TABS)[number]['id'];

function StatusBadge({ status }: { status: SalesInvoiceStatus }) {
  const map: Record<SalesInvoiceStatus, string> = {
    DRAFT: 'bg-gray-100 text-gray-600',
    POSTED: 'bg-emerald-100 text-emerald-700',
    CANCELLED: 'bg-rose-100 text-rose-700',
  };
  return (
    <span
      className={`inline-block rounded-full px-3 py-1 text-xs font-mono font-semibold ${map[status]}`}
    >
      {status}
    </span>
  );
}

function fmt(n: number) {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function SaleInvoiceDetail({
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
  const [invoice, setInvoice] = useState<SalesInvoice | null>(null);
  const [payments, setPayments] = useState<InvoicePaymentRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{
    msg: string;
    type: 'success' | 'error';
  } | null>(null);
  const [busy, setBusy] = useState<'post' | 'cancel' | 'delete' | null>(null);

  // Permission gating (UX): the server still enforces. A button shows only when
  // BOTH the document status allows it (a.can_*) AND the user holds the grant.
  const may = {
    update: useCan(PERMISSIONS.sales.invoice.update),
    post: useCan(PERMISSIONS.sales.invoice.post),
    cancel: useCan(PERMISSIONS.sales.invoice.cancel),
    delete: useCan(PERMISSIONS.sales.invoice.delete),
  };

  function showToast(msg: string, type: 'success' | 'error') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }

  async function load() {
    setLoading(true);
    try {
      const [inv, pays] = await Promise.all([
        financesInvoiceApi.get(id),
        financesInvoiceApi.payments(id).catch(() => []),
      ]);
      setInvoice(inv);
      setPayments(pays);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load invoice');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (id) load();
  }, [id]);

  async function handlePost() {
    if (!invoice) return;
    setBusy('post');
    try {
      await financesInvoiceApi.post(invoice.id);
      showToast('Invoice posted.', 'success');
      await load();
    } catch (e) {
      showToast(
        e instanceof Error ? e.message : 'Failed to post invoice',
        'error',
      );
    } finally {
      setBusy(null);
    }
  }

  async function handleCancel() {
    if (!invoice) return;
    setBusy('cancel');
    try {
      await financesInvoiceApi.cancel(invoice.id);
      showToast('Invoice cancelled.', 'success');
      await load();
    } catch (e) {
      showToast(
        e instanceof Error ? e.message : 'Failed to cancel invoice',
        'error',
      );
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete() {
    if (!invoice) return;
    setBusy('delete');
    try {
      await financesInvoiceApi.remove(invoice.id);
      showToast('Invoice deleted.', 'success');
      router.push('/finances/invoice');
    } catch (e) {
      showToast(
        e instanceof Error ? e.message : 'Failed to delete invoice',
        'error',
      );
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

  if (error || !invoice) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <FileWarning className="text-muted-foreground" size={40} />
        <p className="text-sm text-muted-foreground">
          {error || 'Invoice not found.'}
        </p>
        <button
          onClick={() => router.push('/finances/invoice')}
          className="text-xs text-sky-600 hover:underline"
        >
          Back to list
        </button>
      </div>
    );
  }

  const a = invoice.actions;

  return (
    <div className="space-y-4 font-mono text-xs">
      {toast && (
        <div
          className={`fixed right-4 top-4 z-50 rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}
        >
          {toast.msg}
        </div>
      )}

      <div>
        <button
          onClick={() => router.push('/finances/invoice')}
          className="inline-flex items-center gap-2 text-slate-500 transition-colors hover:text-slate-700"
        >
          <ArrowLeftIcon size={16} /> Back to Invoices
        </button>
        <h2 className="mt-3 flex items-center gap-3 text-2xl font-bold text-slate-800 md:text-3xl">
          <FileText className="text-[#1a9e52]" />
          {invoice.invoice_no}
          <StatusBadge status={invoice.status} />
          <PaymentStatusBadge status={invoice.payment_status} />
        </h2>
      </div>

      <FormLayout
        sidebar={
          <>
            <SidebarCard
              icon={<ReceiptText size={13} />}
              title="Invoice Summary"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Customer</span>
                  <span className="font-semibold text-slate-700">
                    {invoice.customer_name || '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Invoice Date</span>
                  <span className="font-semibold text-slate-700">
                    {invoice.invoice_date}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Shipment</span>
                  <button
                    onClick={() =>
                      router.push(
                        `/sale/delivery-note/${invoice.shipment_id}/view`,
                      )
                    }
                    className="font-semibold text-sky-600 hover:underline"
                  >
                    {invoice.shipment_no}
                  </button>
                </div>
                {invoice.sales_order_id && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Sales Order</span>
                    <button
                      onClick={() =>
                        router.push(
                          `/sale/order/${invoice.sales_order_id}/view`,
                        )
                      }
                      className="font-semibold text-sky-600 hover:underline"
                    >
                      {invoice.sales_order_no}
                    </button>
                  </div>
                )}
                <div className="mt-2 space-y-1.5 rounded-xl bg-slate-50 p-3">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Subtotal</span>
                    <span>{fmt(invoice.subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Discount</span>
                    <span className="text-rose-500">
                      - {fmt(invoice.discount_total)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Tax</span>
                    <span>{fmt(invoice.tax_total)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-1.5 text-sm font-semibold">
                    <span>Grand Total</span>
                    <span>
                      {invoice.currency} {fmt(invoice.grand_total)}
                    </span>
                  </div>
                </div>
              </div>
            </SidebarCard>

          <div className="flex flex-col gap-2">
            <button
              onClick={() =>
                router.push(`/finances/invoice/${invoice.id}/print`)
              }
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-slate-700 transition-colors hover:bg-slate-50"
            >
              <PrinterIcon size={14} /> Print / PDF
            </button>
            {/* Record a payment against this posted, not-fully-paid invoice. */}
            {invoice.status === 'POSTED' && invoice.outstanding > 0 && (
              <button
                onClick={() =>
                  router.push(
                    `/finances/payment/create?customer=${encodeURIComponent(
                      invoice.customer_name ?? '',
                    )}&phone=${encodeURIComponent(
                      invoice.customer_phone ?? '',
                    )}`,
                  )
                }
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1a9e52] px-4 py-2.5 font-semibold text-white transition-colors hover:bg-[#158042]"
              >
                <WalletIcon size={14} /> Record Payment
              </button>
            )}
          </div>

          {((a?.can_update && may.update) || (a?.can_post && may.post) || (a?.can_cancel && may.cancel) || (a?.can_delete && may.delete)) && (
            <div className="flex flex-col gap-2">
              {a?.can_update && may.update && (
                <button
                  onClick={() =>
                    router.push(`/finances/invoice/${invoice.id}/update`)
                  }
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-violet-200 px-4 py-2.5 text-violet-600 transition-colors hover:bg-violet-50"
                >
                  <PencilIcon size={14} /> Edit
                </button>
              )}
              {a?.can_post && may.post && (
                <button
                  onClick={handlePost}
                  disabled={busy !== null}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1a9e52] px-4 py-2.5 font-semibold text-white transition-colors hover:bg-[#158042] disabled:opacity-60"
                >
                  {busy === 'post' ? (
                    <Loader2Icon size={14} className="animate-spin" />
                  ) : (
                    <SendIcon size={14} />
                  )}
                  Post
                </button>
              )}
              {a?.can_cancel && may.cancel && (
                <button
                  onClick={handleCancel}
                  disabled={busy !== null}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-rose-700 transition-colors hover:bg-rose-100 disabled:opacity-60"
                >
                  {busy === 'cancel' ? (
                    <Loader2Icon size={14} className="animate-spin" />
                  ) : (
                    <Ban size={14} />
                  )}
                  Cancel Invoice
                </button>
              )}
              {a?.can_delete && may.delete && (
                <button
                  onClick={handleDelete}
                  disabled={busy !== null}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 px-4 py-2.5 text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-60"
                >
                  {busy === 'delete' ? (
                    <Loader2Icon size={14} className="animate-spin" />
                  ) : (
                    <Trash2Icon size={14} />
                  )}
                  Delete
                </button>
              )}
            </div>
          )}

            <AuditInformationCard audit={invoice as Partial<AuditMeta>} />
          </>
        }
      >
        <TabNav tabs={TABS} active={activeTab} onChangeAction={setActiveTab} />

        {activeTab === 'info' && (
          <TabPanel>
            <SectionCard
              icon={<FileText size={13} />}
              title="Invoice Information"
            >
              <FieldGrid>
                <div>
                  <FieldLabel>Reference No</FieldLabel>
                  <ReadonlyInput value={invoice.reference_no ?? ''} />
                </div>
                <div>
                  <FieldLabel>Customer</FieldLabel>
                  <ReadonlyInput value={invoice.customer_name ?? ''} />
                </div>
                <div>
                  <FieldLabel>Customer Phone</FieldLabel>
                  <ReadonlyInput value={invoice.customer_phone ?? ''} />
                </div>
                <div>
                  <FieldLabel>Customer Address</FieldLabel>
                  <ReadonlyInput value={invoice.customer_address ?? ''} />
                </div>
                <div>
                  <FieldLabel>Invoice Date</FieldLabel>
                  <ReadonlyInput value={invoice.invoice_date} />
                </div>
                <div>
                  <FieldLabel>Currency</FieldLabel>
                  <ReadonlyInput value={invoice.currency} />
                </div>
                <div>
                  <FieldLabel>Exchange Rate</FieldLabel>
                  <ReadonlyInput value={invoice.exchange_rate} />
                </div>
                <div>
                  <FieldLabel>Payment Status</FieldLabel>
                  <div className="flex min-h-11.5 items-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <PaymentStatusBadge status={invoice.payment_status} />
                  </div>
                </div>
                <div>
                  <FieldLabel>Invoice Total</FieldLabel>
                  <div className="flex min-h-11.5 items-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                    {invoice.currency} {fmt(invoice.grand_total)}
                  </div>
                </div>
                <div>
                  <FieldLabel>Paid Amount</FieldLabel>
                  <div className="flex min-h-11.5 items-center rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                    {invoice.currency} {fmt(invoice.amount_paid)}
                  </div>
                </div>
                <div>
                  <FieldLabel>Remaining Balance</FieldLabel>
                  <div
                    className={`flex min-h-11.5 items-center rounded-xl border px-4 py-3 text-sm font-semibold ${
                      invoice.outstanding > 0
                        ? 'border-amber-200 bg-amber-50 text-amber-700'
                        : 'border-slate-200 bg-slate-50 text-slate-500'
                    }`}
                  >
                    {invoice.currency} {fmt(invoice.outstanding)}
                  </div>
                </div>
                <div className="lg:col-span-2">
                  <FieldLabel>Remarks</FieldLabel>
                  <ReadonlyInput value={invoice.remarks ?? ''} />
                </div>
              </FieldGrid>
              <p className="mt-4 text-[11px] text-slate-400">
                Last updated {new Date(invoice.updated_at).toLocaleString()}
              </p>
            </SectionCard>
          </TabPanel>
        )}

        {activeTab === 'items' && (
          <TabPanel>
            <SectionCard icon={<Package size={13} />} title="Items">
              <div className="overflow-x-auto">
                  <table className="w-full text-xs font-mono">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="text-left py-2 pr-3 font-medium">
                          Item
                        </th>
                        <th className="text-left py-2 pr-3 font-medium">UOM</th>
                        <th className="text-right py-2 pr-3 font-medium">
                          Qty
                        </th>
                        <th className="text-right py-2 pr-3 font-medium">
                          Price
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
                      {invoice.items.map((item) => (
                        <tr
                          key={item.id}
                          className="border-b hover:bg-muted/20"
                        >
                          <td className="py-2 pr-3 font-medium">
                            {item.product_name}
                          </td>
                          <td className="py-2 pr-3">{item.uom || '—'}</td>
                          <td className="py-2 pr-3 text-right">
                            {item.quantity}
                          </td>
                          <td className="py-2 pr-3 text-right">
                            {fmt(item.unit_price)}
                          </td>
                          <td className="py-2 pr-3 text-right">
                            {item.discount}%
                          </td>
                          <td className="py-2 pr-3 text-right">{item.tax}%</td>
                          <td className="py-2 text-right font-semibold">
                            {fmt(item.line_total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
              </div>
              <div className="mt-4 flex justify-end">
                <div className="w-56 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Subtotal</span>
                    <span>{fmt(invoice.subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Discount</span>
                    <span className="text-rose-500">
                      - {fmt(invoice.discount_total)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Tax</span>
                    <span>{fmt(invoice.tax_total)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-1.5 text-sm font-semibold">
                    <span>Grand Total</span>
                    <span>
                      {invoice.currency} {fmt(invoice.grand_total)}
                    </span>
                  </div>
                </div>
              </div>
            </SectionCard>
          </TabPanel>
        )}

        {/* Tab 3: Related Documents (document flow) */}
        {activeTab === 'related' && (
          <TabPanel>
            <RelatedDocumentsPanel
                source={[
                  ...(invoice.sales_order_id
                    ? [
                        {
                          key: `so-${invoice.sales_order_id}`,
                          docType: 'Sales Order',
                          number: invoice.sales_order_no,
                          href: `/sale/order/${invoice.sales_order_id}/view`,
                        },
                      ]
                    : []),
                  {
                    key: `sh-${invoice.shipment_id}`,
                    docType: 'Shipment',
                    number: invoice.shipment_no,
                    href: `/sale/delivery-note/${invoice.shipment_id}/view`,
                  },
                ]}
                generated={payments.map((p) => ({
                  key: `pay-${p.id}`,
                  docType: 'Payment',
                  number: p.payment_no,
                  href: `/finances/payment/${p.id}/view`,
                  date: p.payment_date,
                  status: p.status,
                  statusClass: 'bg-emerald-100 text-emerald-700',
                  meta: [
                    {
                      label: 'Method',
                      value: p.payment_method.replace('_', ' '),
                    },
                    {
                      label: 'Amount',
                      value: `${invoice.currency} ${fmt(p.amount)}`,
                    },
                  ],
                }))}
                generatedEmptyText="No payments received yet."
              summary={
                <div className="flex flex-wrap gap-4 rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5">
                  <span className="text-slate-400">
                    Invoice Total{' '}
                    <span className="font-semibold text-slate-700">
                      {invoice.currency} {fmt(invoice.grand_total)}
                    </span>
                  </span>
                  <span className="text-emerald-600">
                    Paid{' '}
                    <span className="font-semibold">
                      {fmt(invoice.amount_paid)}
                    </span>
                  </span>
                  <span
                    className={
                      invoice.outstanding > 0
                        ? 'text-amber-600'
                        : 'text-slate-400'
                    }
                  >
                    Outstanding{' '}
                    <span className="font-semibold">
                      {fmt(invoice.outstanding)}
                    </span>
                  </span>
                </div>
              }
            />
          </TabPanel>
        )}
      </FormLayout>
    </div>
  );
}
