'use client';

import {
  ButtonActionDynamicRender,
  ButtonActionStaticRender,
} from '@/components/ui/button-action';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { DataTable } from '@/components/ui/DataTable';
import PopUpDeleteTransactionModal from '@/components/ui/PopUpDeleteModal';
import { useRegisterModule } from '@/hook/useModule';
import { usePageActions } from '@/hook/usePageAction';
import type { ModuleProps } from '@/lib/registry';
import { useState } from 'react';
import { getWarehouseCols, TWarehouse } from './columns';

export default function WarehousePage({
  currentPath,
  permission,
  initialData,
  currentPathActions,
}: ModuleProps) {
  useRegisterModule({
    actionModules: currentPathActions,
    permission,
    modulePath: currentPath.path,
  });

  const pageAction = usePageActions();
  const staticActions = pageAction?.actions.filter((a) => !a.dynamic) ?? [];
  const dynamicActions = pageAction?.actions.filter((a) => a.dynamic) ?? [];

  const apiBase = pageAction.actions.find(
    (item) => item.label.toLocaleLowerCase() === 'create',
  )?.key!;

  const [data, setData] = useState<TWarehouse[]>(
    (initialData as TWarehouse[]) ?? [],
  );

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
      const res = await fetch(`${apiBase}/${deletingId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Delete failed');
      setData((prev) => prev.filter((w) => w.id !== deletingId));
      showToast('Warehouse deleted', 'success');
    } catch {
      showToast('Delete failed', 'error');
    } finally {
      setDeleting(false);
      setDeletingId(null);
    }
  };

  return (
    <div className="mx-auto animate-in fade-in duration-300">
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-lg transition-all ${
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

      <div className="flex flex-col md:flex-row md:items-end justify-between mb-4">
        <div />
        <div className="flex items-center gap-2">
          {staticActions.map((action) => (
            <span key={action.href}>
              {ButtonActionStaticRender(action, false)}
            </span>
          ))}
        </div>
      </div>

      <DataTable
        columns={getWarehouseCols({
          dynamicActions,
          onDelete: (id: number) => setDeletingId(id),
        })}
        data={data}
        keyExtractor={(r) => r.id}
        searchFn={(row, q) =>
          row.name.toLowerCase().includes(q)
        }
        searchPlaceholder="Search warehouses..."
        emptyTitle="No warehouses yet"
      />
    </div>
  );
}
