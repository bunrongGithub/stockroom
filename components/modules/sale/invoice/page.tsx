'use client';

import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { useRegisterModule } from '@/hook/useModule';
import type { ModuleProps } from '@/lib/registry';
import { financesInvoiceApi } from '@/lib/api/finances';
import type {
  SalesInvoice,
  SalesInvoiceStatus,
} from '@/types/sales/order-management';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  EyeIcon,
  PencilIcon,
  SendIcon,
  Ban,
  Trash2Icon,
} from 'lucide-react';
import PaymentStatusBadge from './PaymentStatusBadge';

function StatusBadge({ status }: { status: SalesInvoiceStatus }) {
  const map: Record<SalesInvoiceStatus, string> = {
    DRAFT: 'bg-gray-100 text-gray-600',
    POSTED: 'bg-emerald-100 text-emerald-800',
    CANCELLED: 'bg-rose-100 text-rose-800',
  };
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-mono font-medium ${map[status]}`}
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

export default function SaleInvoicePage({
  currentPath,
  permission,
  currentPathActions,
  initialData,
}: ModuleProps) {
  useRegisterModule({
    actionModules: currentPathActions,
    permission,
    modulePath: currentPath.path,
  });

  const router = useRouter();
  const [invoices, setInvoices] = useState<SalesInvoice[]>(
    (initialData as SalesInvoice[]) ?? [],
  );
  const [toast, setToast] = useState<{
    msg: string;
    type: 'success' | 'error';
  } | null>(null);
  const [confirm, setConfirm] = useState<{
    type: 'post' | 'cancel' | 'delete';
    id: number;
    no: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  function showToast(msg: string, type: 'success' | 'error') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }

  async function refreshInvoices() {
    try {
      setInvoices(await financesInvoiceApi.list());
    } catch (e) {
      showToast(
        e instanceof Error ? e.message : 'Failed to load invoices',
        'error',
      );
    }
  }

  async function runAction() {
    if (!confirm) return;
    setBusy(true);
    try {
      if (confirm.type === 'post') await financesInvoiceApi.post(confirm.id);
      else if (confirm.type === 'cancel')
        await financesInvoiceApi.cancel(confirm.id);
      else await financesInvoiceApi.remove(confirm.id);
      showToast(
        confirm.type === 'post'
          ? 'Invoice posted.'
          : confirm.type === 'cancel'
            ? 'Invoice cancelled.'
            : 'Invoice deleted.',
        'success',
      );
      await refreshInvoices();
    } catch (e) {
      showToast(
        e instanceof Error ? e.message : `Cannot ${confirm.type} invoice`,
        'error',
      );
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }

  const columns: DataTableColumn<SalesInvoice>[] = [
    {
      key: 'invoice_no',
      header: 'Invoice No',
      cell: (row) => (
        <button
          onClick={() => router.push(`/finances/invoice/${row.id}/view`)}
          className="font-mono text-xs font-semibold text-sky-600 hover:underline"
        >
          {row.invoice_no}
        </button>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      cell: (row) => (
        <span className="font-mono text-xs">{row.customer_name || '—'}</span>
      ),
    },
    {
      key: 'invoice_date',
      header: 'Date',
      cell: (row) => (
        <span className="font-mono text-xs">{row.invoice_date}</span>
      ),
    },
    {
      key: 'shipment',
      header: 'Shipment',
      cell: (row) => (
        <span className="font-mono text-xs">{row.shipment_no}</span>
      ),
    },
    {
      key: 'grand_total',
      header: 'Grand Total',
      cell: (row) => (
        <span className="font-mono text-xs font-semibold">
          {row.currency} {fmt(row.grand_total)}
        </span>
      ),
    },
    {
      key: 'outstanding',
      header: 'Outstanding',
      cell: (row) => (
        <span
          className={`font-mono text-xs ${row.outstanding > 0 ? 'text-amber-600 font-semibold' : 'text-slate-400'}`}
        >
          {fmt(row.outstanding)}
        </span>
      ),
    },
    {
      key: 'payment_status',
      header: 'Payment',
      cell: (row) => <PaymentStatusBadge status={row.payment_status} />,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      cell: (row) => {
        const a = row.actions;
        return (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => router.push(`/finances/invoice/${row.id}/view`)}
              className="inline-flex items-center gap-1 rounded-lg border border-sky-200 px-2 py-1 text-xs text-sky-600 hover:bg-sky-50 font-mono"
            >
              <EyeIcon size={11} /> View
            </button>
            {a?.can_update && (
              <button
                onClick={() =>
                  router.push(`/finances/invoice/${row.id}/update`)
                }
                className="inline-flex items-center gap-1 rounded-lg border border-violet-200 px-2 py-1 text-xs text-violet-600 hover:bg-violet-50 font-mono"
              >
                <PencilIcon size={11} /> Edit
              </button>
            )}
            {a?.can_post && (
              <button
                onClick={() =>
                  setConfirm({ type: 'post', id: row.id, no: row.invoice_no })
                }
                className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 px-2 py-1 text-xs text-emerald-600 hover:bg-emerald-50 font-mono"
              >
                <SendIcon size={11} /> Post
              </button>
            )}
            {a?.can_cancel && (
              <button
                onClick={() =>
                  setConfirm({
                    type: 'cancel',
                    id: row.id,
                    no: row.invoice_no,
                  })
                }
                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 font-mono"
              >
                <Ban size={11} /> Cancel
              </button>
            )}
            {a?.can_delete && (
              <button
                onClick={() =>
                  setConfirm({
                    type: 'delete',
                    id: row.id,
                    no: row.invoice_no,
                  })
                }
                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 font-mono"
              >
                <Trash2Icon size={11} /> Delete
              </button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <main className="space-y-4">
      {toast && (
        <div
          className={`fixed right-4 top-4 z-50 rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}
        >
          {toast.msg}
        </div>
      )}

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="w-80 space-y-4 rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-sm font-semibold capitalize">
              {confirm.type} Invoice
            </h3>
            <p className="text-xs text-muted-foreground">
              {confirm.type === 'post'
                ? `Post ${confirm.no}? It becomes an official, read-only invoice.`
                : confirm.type === 'cancel'
                  ? `Cancel ${confirm.no}? The shipment reverts to Shipped.`
                  : `Delete draft ${confirm.no}? The shipment reverts to Shipped.`}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirm(null)}
                className="rounded-lg border px-3 py-1.5 text-xs hover:bg-muted font-mono"
              >
                Back
              </button>
              <button
                disabled={busy}
                onClick={runAction}
                className={`rounded-lg px-3 py-1.5 text-xs text-white font-mono disabled:opacity-60 ${confirm.type === 'post' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-500 hover:bg-rose-600'}`}
              >
                {busy ? 'Working…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Billing documents issued from shipments
          </p>
        </div>
      </div>

      <DataTable<SalesInvoice>
        columns={columns}
        data={invoices}
        keyExtractor={(row) => row.id}
        searchFn={(row, q) =>
          row.invoice_no.toLowerCase().includes(q) ||
          (row.customer_name ?? '').toLowerCase().includes(q) ||
          row.shipment_no.toLowerCase().includes(q) ||
          row.status.toLowerCase().includes(q)
        }
        searchPlaceholder="Search by invoice no, customer, shipment, or status..."
        pageSize={10}
        emptyTitle="No invoices"
        emptyDescription="Create an invoice from a posted shipment"
      />
    </main>
  );
}
