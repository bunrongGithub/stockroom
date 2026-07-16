'use client';
import { ButtonActionStaticRender } from '@/components/ui/button-action';
import { DataTable, type DataTableFilterDef } from '@/components/ui/DataTable';
import PopUpDeleteTransactionModal from '@/components/ui/PopUpDeleteModal';
import { usePageActions } from '@/hook/usePageAction';
import type { ServerQueryBinding } from '@/hook/useTableQuery';
import { ReceiptTxnType } from '@/service/apps/inventory/repo/receipt';
import type { Action } from '@/types';
import { ReceiptIcon } from 'lucide-react';
import { useState } from 'react';
import { getReceiptTxnColumns } from './columns';

const FILTER_DEFS: DataTableFilterDef[] = [
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { value: 'DRAFT', label: 'Draft' },
      { value: 'POSTED', label: 'Posted' },
      { value: 'VOID', label: 'Void' },
    ],
  },
  { key: 'transaction_date', label: 'Transaction Date', type: 'date-range' },
];

const Header = ({ staticActions }: { staticActions: Action }) => (
  <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
    <div>
      <h2 className="flex items-center gap-2 text-2xl text-slate-800">
        <ReceiptIcon className="text-[#1a9e52]" />
        Receipt
      </h2>
      <p className="mt-1 text-slate-500">Transaction Receipt</p>
    </div>
    <div className="flex items-center gap-2">
      {staticActions.map((action) => (
        <span key={action.key}>{ButtonActionStaticRender(action, false)}</span>
      ))}
    </div>
  </div>
);

function Receipt({
  receipts,
  serverQuery,
  onRefresh,
}: {
  receipts: ReceiptTxnType[];
  serverQuery: ServerQueryBinding;
  onRefresh: () => Promise<void>;
}) {
  const pageAction = usePageActions();
  const staticActions = pageAction?.actions.filter((a) => !a.dynamic) ?? [];
  const dynamicActions = pageAction?.actions.filter((a) => a.dynamic) ?? [];

  const apiBase =
    pageAction?.actions.find(
      (item) => item.label.toLocaleLowerCase() === 'create',
    )?.key ?? '/api/inventory/receipts';

  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<{
    msg: string;
    type: 'success' | 'error';
  } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    setDeleting(true);
    try {
      const res = await fetch(`${apiBase}/${deletingId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      await onRefresh();
      showToast('Receipt deleted', 'success');
    } catch {
      showToast('Delete failed', 'error');
    } finally {
      setDeleting(false);
      setDeletingId(null);
    }
  };

  return (
    <main className="font-mono">
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 rounded-xl px-4 py-3 text-sm font-medium shadow-lg transition-all ${
            toast.type === 'success'
              ? 'bg-emerald-500 text-white'
              : 'bg-rose-500 text-white'
          }`}
        >
          {toast.msg}
        </div>
      )}

      <PopUpDeleteTransactionModal
        open={!!deletingId}
        loading={deleting}
        onClose={() => setDeletingId(null)}
        onConfirm={handleDelete}
      />

      <Header staticActions={staticActions} />
      <DataTable<ReceiptTxnType>
        columns={getReceiptTxnColumns({
          dynamicActions,
          onDelete: (id: number) => setDeletingId(id),
        })}
        data={receipts}
        keyExtractor={(row) => row.id ?? 0}
        searchPlaceholder="Search by reference or source reference..."
        pageSizeOptions={[10, 20, 50]}
        serverQuery={serverQuery}
        filterDefs={FILTER_DEFS}
        enableColumnVisibility
      />
    </main>
  );
}

export default Receipt;
