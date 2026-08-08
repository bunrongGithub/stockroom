'use client';

import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { auditUserColumns } from '@/components/ui/audit-columns';
import { RowAction, RowActions } from '@/components/ui/button-action';
import { useRegisterModule } from '@/hook/useModule';
import { useTableQuery } from '@/hook/useTableQuery';
import type { ModuleProps } from '@/lib/registry';
import { financesInvoiceApi } from '@/lib/api/finances';
import { API } from '@/lib/constant';
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
  initialMeta,
}: ModuleProps) {
  useRegisterModule({
    actionModules: currentPathActions,
    permission,
    modulePath: currentPath.path,
  });

  const router = useRouter();
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

  // Query Framework: search/sort/filter/pagination run server-side and the
  // full list state lives in the URL.
  const table = useTableQuery<SalesInvoice>({
    endpoint: API.finances.invoice.root,
    initialData: initialData as SalesInvoice[] | undefined,
    initialMeta,
  });

  async function refreshInvoices() {
    await table.refresh();
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
      sortable: true,
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
      sortable: true,
      sortKey: 'customer_name',
      cell: (row) => (
        <span className="font-mono text-xs">{row.customer_name || '—'}</span>
      ),
    },
    {
      key: 'invoice_date',
      header: 'Date',
      sortable: true,
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
      sortable: true,
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
    ...auditUserColumns<SalesInvoice>(),
    {
      key: 'actions',
      header: 'Actions',
      sticky: 'right',
      align: 'right',
      cell: (row) => {
        const a = row.actions;
        return (
          <RowActions>
            <RowAction
              label="View"
              icon={<EyeIcon size={13} />}
              href={`/finances/invoice/${row.id}/view`}
            />
            {a?.can_update && (
              <RowAction
                label="Edit"
                icon={<PencilIcon size={13} />}
                href={`/finances/invoice/${row.id}/update`}
              />
            )}
            {a?.can_post && (
              <RowAction
                label="Post"
                icon={<SendIcon size={13} />}
                tone="primary"
                onClick={() =>
                  setConfirm({ type: 'post', id: row.id, no: row.invoice_no })
                }
              />
            )}
            {a?.can_cancel && (
              <RowAction
                label="Cancel"
                icon={<Ban size={13} />}
                tone="danger"
                onClick={() =>
                  setConfirm({
                    type: 'cancel',
                    id: row.id,
                    no: row.invoice_no,
                  })
                }
              />
            )}
            {a?.can_delete && (
              <RowAction
                label="Delete"
                icon={<Trash2Icon size={13} />}
                tone="danger"
                onClick={() =>
                  setConfirm({
                    type: 'delete',
                    id: row.id,
                    no: row.invoice_no,
                  })
                }
              />
            )}
          </RowActions>
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
        data={table.data}
        keyExtractor={(row) => row.id}
        mobileVariant="cards"
        minTableWidth="1560px"
        searchPlaceholder="Search by invoice no, reference, or customer..."
        pageSizeOptions={[10, 20, 50]}
        serverQuery={table.binding}
        filterDefs={[
          {
            key: 'status',
            label: 'Status',
            type: 'select',
            options: [
              { value: 'DRAFT', label: 'Draft' },
              { value: 'POSTED', label: 'Posted' },
              { value: 'CANCELLED', label: 'Cancelled' },
            ],
          },
          { key: 'invoice_date', label: 'Invoice Date', type: 'date-range' },
        ]}
        enableColumnVisibility
        emptyTitle="No invoices"
        emptyDescription="Create an invoice from a posted shipment"
      />
    </main>
  );
}
