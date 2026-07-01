'use client';
import { ButtonActionStaticRender } from '@/components/ui/button-action';
import { DataTable } from '@/components/ui/DataTable';
import PopUpDeleteTransactionModal from '@/components/ui/PopUpDeleteModal';
import { usePageActions } from '@/hook/usePageAction';
import { ReceiptTxnType } from '@/service/apps/inventory/repo/receipt';
import { TMeta } from '@/types/app';
import { ReceiptIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getReceiptTxnColumns } from './columns';

const Header = ({ staticActions }: { staticActions: any }) => (
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
  meta,
}: {
  receipts: ReceiptTxnType[];
  meta: TMeta;
}) {
  const pageAction = usePageActions();
  const staticActions = pageAction?.actions.filter((a) => !a.dynamic) ?? [];
  const dynamicActions = pageAction?.actions.filter((a) => a.dynamic) ?? [];

  const apiBase = pageAction?.actions.find(
    (item) => item.label.toLocaleLowerCase() === 'create',
  )?.key!;

  const [data, setData] = useState<ReceiptTxnType[]>(receipts ?? []);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<{
    msg: string;
    type: 'success' | 'error';
  } | null>(null);

  useEffect(() => {
    setData(receipts ?? []);
  }, [receipts]);

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
      setData((prev) => prev.filter((r) => r.id !== deletingId));
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
        data={data}
        keyExtractor={(row) => row.id ?? 0}
      />
    </main>
  );
}

export default Receipt;
