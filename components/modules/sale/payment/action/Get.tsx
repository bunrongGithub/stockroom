'use client';

import { useRegisterModule } from '@/hook/useModule';
import { useCan } from '@/hook/useCan';
import { PERMISSIONS } from '@/service/core/authz/permissions';
import type { ModuleProps } from '@/lib/registry';
import { financesPaymentApi } from '@/lib/api/finances';
import { AuditInformationCard } from '@/components/ui/AuditInformationCard';
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
    <div className="space-y-5 font-mono text-xs">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-800">
            <WalletIcon size={18} className="text-[#1a9e52]" />
            {payment.payment_no}
          </h1>
          <StatusBadge status={payment.status} />
        </div>
        <div className="flex gap-1.5">
          {a?.can_update && (
            <button
              onClick={() => router.push(`/finances/payment/${payment.id}/update`)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-violet-200 px-3 py-2 text-violet-600 hover:bg-violet-50"
            >
              <PencilIcon size={13} /> Edit
            </button>
          )}
          {a?.can_post && mayPost && (
            <button
              onClick={() => act('post')}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-500 disabled:opacity-60"
            >
              {busy ? (
                <Loader2Icon className="animate-spin" size={13} />
              ) : (
                <SendIcon size={13} />
              )}
              Post
            </button>
          )}
          {a?.can_cancel && mayCancel && (
            <button
              onClick={() => act('cancel')}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-rose-700 hover:bg-rose-100 disabled:opacity-60"
            >
              {busy ? (
                <Loader2Icon className="animate-spin" size={13} />
              ) : (
                <Ban size={13} />
              )}
              Cancel
            </button>
          )}
          <button
            onClick={() => router.push('/finances/payment')}
            className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 hover:bg-muted"
          >
            <ArrowLeftIcon size={13} /> Back
          </button>
        </div>
      </div>

      {actionError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700">
          {actionError}
        </div>
      )}

      {/* Payment information */}
      <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-500">
          Payment Information
        </h3>
        <div className="grid grid-cols-2 gap-y-3 lg:grid-cols-4">
          <span className="text-slate-400">Customer</span>
          <span className="font-medium">{payment.customer_name}</span>
          <span className="text-slate-400">Phone</span>
          <span>{payment.customer_phone || '—'}</span>
          <span className="text-slate-400">Payment Date</span>
          <span>{payment.payment_date}</span>
          <span className="text-slate-400">Method</span>
          <span>
            {METHOD_LABEL[payment.payment_method] ?? payment.payment_method}
          </span>
          <span className="text-slate-400">Reference No</span>
          <span>{payment.reference_no || '—'}</span>
          <span className="text-slate-400">Amount</span>
          <span className="font-semibold">
            {payment.currency} {money(payment.amount)}
          </span>
          <span className="text-slate-400">Remarks</span>
          <span className="col-span-3">{payment.remarks || '—'}</span>
        </div>
      </section>

      {/* Allocations */}
      <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-500">
          Allocated Invoices ({payment.allocations.length})
        </h3>
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
      </section>

      <AuditInformationCard audit={payment as Partial<AuditMeta>} />
    </div>
  );
}
