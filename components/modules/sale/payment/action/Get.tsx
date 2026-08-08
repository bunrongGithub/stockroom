'use client';

import { useRegisterModule } from '@/hook/useModule';
import { useCan } from '@/hook/useCan';
import { PERMISSIONS } from '@/service/core/authz/permissions';
import type { ModuleProps } from '@/lib/registry';
import { financesPaymentApi } from '@/lib/api/finances';
import { AuditInformationCard } from '@/components/ui/AuditInformationCard';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { ReadonlyInput } from '@/components/ui/Readonly';
import {
  FieldGrid,
  FormLayout,
  SectionCard,
  SidebarCard,
} from '@/components/ui/FormShell';
import type { AuditMeta } from '@/types/audit';
import type { CustomerPayment, PaymentStatus } from '@/types/sales/payment';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeftIcon,
  Ban,
  FileWarning,
  Loader2Icon,
  PencilIcon,
  ReceiptText,
  SendIcon,
  WalletIcon,
} from 'lucide-react';

const METHOD_LABEL: Record<string, string> = {
  CASH: 'Cash',
  BANK_TRANSFER: 'Bank Transfer',
  CARD: 'Card',
  CHEQUE: 'Cheque',
  OTHER: 'Other',
};

function StatusBadge({ status }: { status: PaymentStatus }) {
  const map: Record<PaymentStatus, string> = {
    DRAFT: 'bg-gray-100 text-gray-600',
    POSTED: 'bg-emerald-100 text-emerald-800',
    CANCELLED: 'bg-rose-100 text-rose-800',
  };
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-1 text-xs font-mono font-medium ${map[status]}`}
    >
      {status}
    </span>
  );
}

function money(n: number) {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Registered as `SalePaymentDetail`.
export default function SalePaymentDetail({
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
  const mayPost = useCan(PERMISSIONS.sales.payment.post);
  const mayCancel = useCan(PERMISSIONS.sales.payment.cancel);
  const id = Number(Array.isArray(params.slug) ? params.slug.at(-2) : '');

  const [payment, setPayment] = useState<CustomerPayment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  async function load() {
    try {
      setPayment(await financesPaymentApi.get(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load payment');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (id) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function act(kind: 'post' | 'cancel') {
    setActionError('');
    setBusy(true);
    try {
      if (kind === 'post') await financesPaymentApi.post(id);
      else await financesPaymentApi.cancel(id);
      await load();
      router.refresh();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : `Cannot ${kind} payment`);
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

  if (error || !payment) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3">
        <FileWarning className="text-muted-foreground" size={40} />
        <p className="text-sm text-muted-foreground">
          {error || 'Payment not found.'}
        </p>
        <button
          onClick={() => router.push('/sale/payment')}
          className="text-xs text-sky-600 hover:underline"
        >
          Back to list
        </button>
      </div>
    );
  }

  const a = payment.actions;

  return (
    <div className="space-y-4 font-mono text-xs">
      {/* Header */}
      <div>
        <button
          onClick={() => router.push('/finances/payment')}
          className="inline-flex items-center gap-2 text-slate-500 transition-colors hover:text-slate-700"
        >
          <ArrowLeftIcon size={16} /> Back to Payments
        </button>
        <h2 className="mt-3 flex items-center gap-3 text-2xl font-bold text-slate-800 md:text-3xl">
          <WalletIcon className="text-[#1a9e52]" />
          {payment.payment_no}
          <StatusBadge status={payment.status} />
        </h2>
      </div>

      <FormLayout
        sidebar={
          <>
            <SidebarCard
              icon={<WalletIcon size={13} />}
              title="Payment Summary"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Customer</span>
                  <span className="font-semibold text-slate-700">
                    {payment.customer_name || '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Payment Date</span>
                  <span className="font-semibold text-slate-700">
                    {payment.payment_date}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Allocations</span>
                  <span className="font-semibold text-slate-700">
                    {payment.allocations.length}
                  </span>
                </div>
                <div className="mt-2 flex justify-between rounded-xl bg-slate-50 p-3 text-sm font-semibold">
                  <span>Amount</span>
                  <span>
                    {payment.currency} {money(payment.amount)}
                  </span>
                </div>
              </div>
            </SidebarCard>

            {actionError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">
                {actionError}
              </div>
            )}

            <div className="flex flex-col gap-2">
              {a?.can_update && (
                <button
                  onClick={() =>
                    router.push(`/finances/payment/${payment.id}/update`)
                  }
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-violet-200 px-4 py-2.5 text-violet-600 transition-colors hover:bg-violet-50"
                >
                  <PencilIcon size={14} /> Edit
                </button>
              )}
              {a?.can_post && mayPost && (
                <button
                  onClick={() => act('post')}
                  disabled={busy}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1a9e52] px-4 py-2.5 font-semibold text-white transition-colors hover:bg-[#158042] disabled:opacity-60"
                >
                  {busy ? (
                    <Loader2Icon className="animate-spin" size={14} />
                  ) : (
                    <SendIcon size={14} />
                  )}
                  Post
                </button>
              )}
              {a?.can_cancel && mayCancel && (
                <button
                  onClick={() => act('cancel')}
                  disabled={busy}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-rose-700 transition-colors hover:bg-rose-100 disabled:opacity-60"
                >
                  {busy ? (
                    <Loader2Icon className="animate-spin" size={14} />
                  ) : (
                    <Ban size={14} />
                  )}
                  Cancel
                </button>
              )}
            </div>

            <AuditInformationCard audit={payment as Partial<AuditMeta>} />
          </>
        }
      >
        <div className="space-y-5">
          {/* Payment information */}
          <SectionCard
            icon={<WalletIcon size={13} />}
            title="Payment Information"
          >
            <FieldGrid>
              <div>
                <FieldLabel>Customer</FieldLabel>
                <ReadonlyInput value={payment.customer_name} />
              </div>
              <div>
                <FieldLabel>Phone</FieldLabel>
                <ReadonlyInput value={payment.customer_phone ?? ''} />
              </div>
              <div>
                <FieldLabel>Payment Date</FieldLabel>
                <ReadonlyInput value={payment.payment_date} />
              </div>
              <div>
                <FieldLabel>Method</FieldLabel>
                <ReadonlyInput
                  value={
                    METHOD_LABEL[payment.payment_method] ??
                    payment.payment_method
                  }
                />
              </div>
              <div>
                <FieldLabel>Reference No</FieldLabel>
                <ReadonlyInput value={payment.reference_no ?? ''} />
              </div>
              <div>
                <FieldLabel>Amount</FieldLabel>
                <div className="flex min-h-11.5 items-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                  {payment.currency} {money(payment.amount)}
                </div>
              </div>
              <div className="lg:col-span-2">
                <FieldLabel>Remarks</FieldLabel>
                <ReadonlyInput value={payment.remarks ?? ''} />
              </div>
            </FieldGrid>
          </SectionCard>

          {/* Allocations */}
          <SectionCard
            icon={<ReceiptText size={13} />}
            title={`Allocated Invoices (${payment.allocations.length})`}
          >
            {payment.allocations.length === 0 ? (
              <p className="py-6 text-center text-slate-400">No allocations.</p>
            ) : (
              <div className="overflow-x-auto">
            <table className="w-full tabular-nums">
              <thead>
                <tr className="border-b text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="py-2 pr-3 text-left font-bold">Invoice No</th>
                  <th className="py-2 pr-3 text-left font-bold">Date</th>
                  <th className="py-2 pr-3 text-right font-bold">
                    Invoice Total
                  </th>
                  <th className="py-2 text-right font-bold">Allocated</th>
                </tr>
              </thead>
              <tbody>
                {payment.allocations.map((al) => (
                  <tr key={al.id} className="border-b last:border-b-0">
                    <td className="py-2 pr-3">
                      <button
                        onClick={() =>
                          router.push(`/finances/invoice/${al.invoice_id}/view`)
                        }
                        className="font-semibold text-sky-600 hover:underline"
                      >
                        {al.invoice_no}
                      </button>
                    </td>
                    <td className="py-2 pr-3 text-slate-500">
                      {al.invoice_date}
                    </td>
                    <td className="py-2 pr-3 text-right">
                      {money(al.grand_total)}
                    </td>
                    <td className="py-2 text-right font-semibold">
                      {money(al.amount)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-slate-200">
                  <td colSpan={3} className="py-2 pr-3 text-right font-bold">
                    Total Payment
                  </td>
                  <td className="py-2 text-right text-sm font-bold">
                    {payment.currency} {money(payment.amount)}
                  </td>
                </tr>
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </div>
      </FormLayout>
    </div>
  );
}
