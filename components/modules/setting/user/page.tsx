'use client';

import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/badge';
import { useRegisterModule } from '@/hook/useModule';
import type { ModuleProps } from '@/lib/registry';
import { Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getUserColumns } from './columns';
import { usePageActions } from '@/hook/usePageAction';
import PopUpDeleteTransactionModal from '@/components/ui/PopUpDeleteModal';
import { TMeta } from '@/types/app';

export type User = {
  id: string;
  email: string;
  full_name: string | null;
  company_id: number | null;
  company: { id: number; name: string } | null;
  company_name: string | null;
  avatar_url: string | null;
  roles: string[] | null;
  created_at: string;
};
const DEFAULT_META: TMeta = { total: 0, page: 1, limit: 10, totalPages: 0 };

export default function Page({
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

  const apiBase = `/api${currentPath.path}`;

  const pageAction = usePageActions();
  const staticActions = pageAction?.actions.filter((a) => !a.dynamic) ?? [];
  const dynamicActions = pageAction?.actions.filter((a) => a.dynamic) ?? [];

  const [users, setUsers] = useState<User[]>([]);
  const [tableMeta, setTableMeta] = useState<TMeta>(
    initialMeta ?? DEFAULT_META,
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [toast, setToast] = useState<{
    msg: string;
    type: 'success' | 'error';
  } | null>(null);

  const columns = getUserColumns({
    dynamicActions,
    onDelete: setDeletingId,
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers(page: number = 1, limit: number = 10) {
    setLoading(true);
    if (!currentPathActions) return;

    if (
      initialData === null ||
      initialData === undefined ||
      initialData.length === 0
    ) {
      fetch(`${apiBase}?page=${page}&limit=${limit}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.error) {
            setError(data.error);
            return;
          }
          const usersData = data.data as User[];
          setUsers(usersData);
        })
        .catch((err) => {
          setError(err.message || 'Failed to fetch users');
        })
        .finally(() => setLoading(false));
    } else {
      setUsers(initialData as User[]);
      setLoading(false);
    }
  }

  const onConfirmDelete = async () => {
    if (!deletingId) return;
    try {
      setIsDeleting(true);
      const res = await fetch(`${apiBase}/${deletingId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setToast({ msg: 'Module deleted successfully', type: 'success' });
      await fetchUsers(tableMeta.page, tableMeta.limit);
    } catch {
      setToast({ msg: 'Failed to delete module', type: 'error' });
    } finally {
      setIsDeleting(false);
      setDeletingId(null);
    }
  };
  return (
    <main className=" mx-auto animate-in fade-in duration-300">
      {toast && (
        <div
          className={`fixed right-4 top-4 z-50 rounded-xl px-4 py-3 text-sm font-medium shadow-lg transition-all ${
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
        loading={isDeleting}
        onClose={() => setDeletingId(null)}
        onConfirm={onConfirmDelete}
      />

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
          <Users size={20} className="text-emerald-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-800">Users</h2>
          <p className="text-sm text-slate-500">
            All registered system users and their roles
          </p>
        </div>
        {!loading && (
          <Badge variant="secondary" className="ml-auto">
            {users.length} user{users.length !== 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={users}
          keyExtractor={(r) => r.id}
          searchFn={(row, q) =>
            row.email.toLowerCase().includes(q) ||
            (row.full_name ?? '').toLowerCase().includes(q)
          }
          searchPlaceholder="Search by email or name..."
          emptyTitle="No users found"
          emptyDescription="Users appear here after they sign up"
        />
      )}
    </main>
  );
}
