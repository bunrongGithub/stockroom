'use client';

import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { RowAction, RowActions } from '@/components/ui/button-action';
import { auditUserColumns } from '@/components/ui/audit-columns';
import { PageHeader, PAGE_ACTION_CLASS } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { useRegisterModule } from '@/hook/useModule';
import { useTableQuery } from '@/hook/useTableQuery';
import type { ModuleProps } from '@/lib/registry';
import { financesPaymentApi } from '@/lib/api/finances';
import { API } from '@/lib/constant';
import type { CustomerPayment, PaymentStatus } from '@/types/sales/payment';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Ban,
  EyeIcon,
  PencilIcon,
  PlusIcon,
  SendIcon,
  Trash2Icon,
} from 'lucide-react';

function StatusBadge({ status }: { status: PaymentStatus }) {
  const map: Record<PaymentStatus, string> = {
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

const METHOD_LABEL: Record<string, string> = {
  CASH: 'Cash',
  BANK_TRANSFER: 'Bank Transfer',
  CARD: 'Card',
  CHEQUE: 'Cheque',
  KHQR: 'ABA KHQR',
  OTHER: 'Other',
};

function fmt(n: number) {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function SalePaymentPage({
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
  const table = useTableQuery<CustomerPayment>({
    endpoint: API.finances.payment.root,
    initialData: initialData as CustomerPayment[] | undefined,
    initialMeta,
  });

  async function refreshPayments() {
    await table.refresh();
  }

  async function runAction() {
    if (!confirm) return;
    setBusy(true);
    try {
      if (confirm.type === 'post') await financesPaymentApi.post(confirm.id);
      else if (confirm.type === 'cancel')
        await financesPaymentApi.cancel(confirm.id);
      else await financesPaymentApi.remove(confirm.id);
      showToast(
        confirm.type === 'post'
          ? 'Payment posted.'
          : confirm.type === 'cancel'
            ? 'Payment cancelled.'
            : 'Payment deleted.',
        'success',
      );
      await refreshPayments();
    } catch (e) {
      showToast(
        e instanceof Error ? e.message : `Cannot ${confirm.type} payment`,
        'error',
      );
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }

  const columns: DataTableColumn<CustomerPayment>[] = [
    {
      key: 'payment_no',
      header: 'Payment No',
      sortable: true,
      cell: (row) => (
        <button
          onClick={() => router.push(`/finances/payment/${row.id}/view`)}
          className="font-mono text-xs font-semibold text-sky-600 hover:underline"
        >
          {row.payment_no}
        </button>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      sortable: true,
      sortKey: 'customer_name',
      cell: (row) => (
        <span className="font-mono text-xs">{row.customer_name}</span>
      ),
    },
    {
      key: 'payment_date',
      header: 'Date',
      sortable: true,
      cell: (row) => (
        <span className="font-mono text-xs">{row.payment_date}</span>
      ),
    },
    {
      key: 'method',
      header: 'Method',
      cell: (row) => (
        <span className="font-mono text-xs">
          {METHOD_LABEL[row.payment_method] ?? row.payment_method}
        </span>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      sortable: true,
      cell: (row) => (
        <span className="font-mono text-xs font-semibold">
          {row.currency} {fmt(row.amount)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => <StatusBadge status={row.status} />,
    },
    ...auditUserColumns<CustomerPayment>(),
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
              href={`/finances/payment/${row.id}/view`}
            />
            {a?.can_update && (
              <RowAction
                label="Edit"
                icon={<PencilIcon size={13} />}
                href={`/finances/payment/${row.id}/update`}
              />
            )}
            {a?.can_post && (
              <RowAction
                label="Post"
                icon={<SendIcon size={13} />}
                tone="primary"
                onClick={() =>
                  setConfirm({ type: 'post', id: row.id, no: row.payment_no })
                }
              />
            )}
            {a?.can_cancel && (
              <RowAction
                label="Cancel"
                icon={<Ban size={13} />}
                tone="danger"
                onClick={() =>
                  setConfirm({ type: 'cancel', id: row.id, no: row.payment_no })
                }
              />
            )}
            {a?.can_delete && (
              <RowAction
                label="Delete"
                icon={<Trash2Icon size={13} />}
                tone="danger"
                onClick={() =>
                  setConfirm({ type: 'delete', id: row.id, no: row.payment_no })
                }
              />
            )}
          </RowActions>
        );
      },
    },
  ];

  return (
    <main className="space-y-4 font-mono">
      {toast && (
        <div
          className={`fixed right-4 top-4 z-50 rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${
            toast.type === 'success'
              ? 'bg-emerald-500 text-white'
              : 'bg-rose-500 text-white'
          }`}
        >
          {toast.msg}
        </div>
      )}

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="w-80 space-y-4 rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-sm font-semibold capitalize">
              {confirm.type} Payment
            </h3>
            <p className="text-xs text-muted-foreground">
              {confirm.type === 'post'
                ? `Post ${confirm.no}? It settles the allocated invoices and becomes read-only.`
                : confirm.type === 'cancel'
                  ? `Cancel ${confirm.no}? The settled invoice balances are restored.`
                  : `Delete draft ${confirm.no}?`}
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
                className={`rounded-lg px-3 py-1.5 text-xs text-white font-mono disabled:opacity-60 ${
                  confirm.type === 'post'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-rose-500 hover:bg-rose-600'
                }`}
              >
                {busy ? 'Working…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      <PageHeader
        title="Customer Payments"
        description="Settle outstanding sales invoices"
        actions={
          permission?.can_create && (
            <Button
              className={PAGE_ACTION_CLASS}
              onClick={() => router.push('/finances/payment/create')}
            >
              <PlusIcon size={16} /> Payment
            </Button>
          )
        }
      />

      <DataTable<CustomerPayment>
        columns={columns}
        data={table.data}
        keyExtractor={(row) => row.id}
        mobileVariant="cards"
        minTableWidth="1520px"
        searchPlaceholder="Search by payment no, reference, or customer..."
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
          {
            key: 'payment_method',
            label: 'Method',
            type: 'select',
            options: Object.entries(METHOD_LABEL).map(([value, label]) => ({
              value,
              label,
            })),
          },
          { key: 'payment_date', label: 'Payment Date', type: 'date-range' },
        ]}
        enableColumnVisibility
        emptyTitle="No payments"
        emptyDescription="Record a customer payment to settle invoices"
      />
    </main>
  );
}
