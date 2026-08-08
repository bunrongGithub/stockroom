'use client';

import { Button } from '@/components/ui/button';
import {
  ButtonActionDynamicRender,
  ButtonActionStaticRender,
} from '@/components/ui/button-action';
import { DataTable } from '@/components/ui/DataTable';
import PopUpDeleteTransactionModal from '@/components/ui/PopUpDeleteModal';
import type { TMeta } from '@/types/app';
import { useRegisterModule } from '@/hook/useModule';
import { usePageActions } from '@/hook/usePageAction';
import type { ModuleProps } from '@/lib/registry';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { getRoleColumns, TRole } from './columns';

const DEFAUL_META = { total: 0, page: 1, limit: 10, totalPages: 0 };
export default function Page({
  currentPath,
  permission,
  initialData,
  initialMeta,
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

  const [data, setData] = useState<TRole[]>((initialData as TRole[]) ?? []);
  const [meta, setMeta] = useState<TMeta>(initialMeta ?? DEFAUL_META);

  const apiBase = `/api${currentPath.path}`;

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

  // Server-side pagination: the list holds one page at a time, so page changes
  // (and refreshes after create/delete) must re-query with page + limit.
  const fetchPage = async (page: number, limit: number) => {
    const res = await fetch(`${apiBase}?page=${page}&limit=${limit}`);
    if (res.ok) {
      const json = await res.json();
      setData(json.data ?? []);
      setMeta(json.meta ?? DEFAUL_META);
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    setDeleting(true);
    try {
      const res = await fetch(`${apiBase}/${deletingId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Delete failed');
      showToast('Role deleted', 'success');
      // Re-fetch so totals/pages stay correct.
      await fetchPage(meta.page, meta.limit);
    } catch {
      showToast('Delete failed', 'error');
    } finally {
      setDeleting(false);
      setDeletingId(null);
    }
  };

  return (
    <div className=" mx-auto animate-in fade-in duration-300">
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

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between">
        <div className="space-y-1">
          {/* <h2 className="text-2xl font-bold text-slate-800">Role</h2>
                    <p className="text-sm text-slate-500">Role in your App </p> */}
        </div>
        <div className="flex items-center gap-2">
          {/* Create is a real page now (RoleCreate), so the action renders as a
              link rather than the popup variant it fell back to before. */}
          {staticActions.map((action) => (
            <span key={action.href}>
              {ButtonActionStaticRender(action, false)}
            </span>
          ))}
        </div>
      </div>

      <DataTable
        columns={getRoleColumns({
          dynamicActions: dynamicActions,
          onDelete: handleDelete,
        })}
        data={data}
        keyExtractor={(r) => r.id}
        searchFn={(row, q) =>
          row.name.toLowerCase().includes(q) ||
          (row.description ?? '').toLowerCase().includes(q)
        }
        searchPlaceholder="Search roles..."
        pageSize={meta.limit}
        pageSizeOptions={[10, 20, 50]}
        serverSide={{
          total: meta.total,
          page: meta.page,
          totalPages: meta.totalPages,
          onPageChange: (p) => fetchPage(p, meta.limit),
          onPageSizeChange: (limit) => fetchPage(1, limit),
        }}
        emptyTitle="No roles yet"
        emptyDescription="Create your first role to get started"
        emptyAction={
          permission.can_create ? (
            <Button
              size="sm"
              asChild
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-500"
            >
              <Link href="/setting/role/create">
                <Plus size={14} /> Add Role
              </Link>
            </Button>
          ) : null
        }
      />
    </div>
  );
}
