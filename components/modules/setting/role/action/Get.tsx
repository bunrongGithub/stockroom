'use client';

import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { useRegisterModule } from '@/hook/useModule';
import type { ModuleProps } from '@/lib/registry';
import { ArrowLeft, Check, Edit2, Loader2, ShieldCheck, X } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

type RolePermission = {
  id: number;
  can_view: boolean;
  can_create: boolean;
  can_update: boolean;
  can_delete: boolean;
  module: {
    id: number;
    key: string;
    path: string;
    label: string;
  };
};

type RoleDetail = {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  company: { id: number; name: string } | null;
  role_module_permission: RolePermission[];
};

function PermBadge({ granted }: { granted: boolean }) {
  return granted ? (
    <span className="inline-flex items-center gap-0.5 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
      <Check size={9} /> Yes
    </span>
  ) : (
    <span className="inline-flex items-center gap-0.5 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
      <X size={9} /> No
    </span>
  );
}

export default function Get({
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
  const id = Number(
    Array.isArray(params.slug) ? params.slug.at(-2) : params.slug,
  );

  const [data, setData] = useState<RoleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    const url = currentPath.key.replace(':id', String(id));
    fetch(url)
      .then((r) => r.json())
      .then((json) => setData(json))
      .catch(() => setError('Failed to load role.'))
      .finally(() => setLoading(false));
  }, [id, currentPath.key]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <Loader2 size={18} className="animate-spin mr-2" /> Loading...
      </div>
    );
  }

  if (error || !data) {
    return (
      <p className="py-10 text-center text-sm text-red-500">
        {error || 'Role not found.'}
      </p>
    );
  }

  const permColumns: DataTableColumn<RolePermission>[] = [
    {
      key: 'module',
      header: 'Module',
      cell: (row) => <span className="font-medium text-slate-800">{row.module.label}</span>,
    },
    {
      key: 'path',
      header: 'Path',
      cell: (row) => <span className="font-mono text-xs text-slate-400">{row.module.path}</span>,
    },
    {
      key: 'can_view',
      header: 'View',
      headerClassName: 'text-center',
      cellClassName: 'text-center',
      cell: (row) => <PermBadge granted={row.can_view} />,
    },
    {
      key: 'can_create',
      header: 'Create',
      headerClassName: 'text-center',
      cellClassName: 'text-center',
      cell: (row) => <PermBadge granted={row.can_create} />,
    },
    {
      key: 'can_update',
      header: 'Update',
      headerClassName: 'text-center',
      cellClassName: 'text-center',
      cell: (row) => <PermBadge granted={row.can_update} />,
    },
    {
      key: 'can_delete',
      header: 'Delete',
      headerClassName: 'text-center',
      cellClassName: 'text-center',
      cell: (row) => <PermBadge granted={row.can_delete} />,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/setting/role"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-slate-700"
          >
            <ArrowLeft size={14} /> Back to Roles
          </Link>
          <h2 className="mt-2 flex items-center gap-2 text-xl font-bold text-slate-800">
            <ShieldCheck className="text-emerald-500" size={20} />
            {data.name}
          </h2>
          {data.description && (
            <p className="mt-0.5 text-sm text-slate-500">{data.description}</p>
          )}
        </div>
        {permission.can_update && (
          <Button size="sm" asChild>
            <Link href={`/setting/role/${data.id}/update`}>
              <Edit2 size={13} /> Edit Role
            </Link>
          </Button>
        )}
      </div>

      {/* Role Info Card */}
      <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
          Role Info
        </h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-slate-400">Name</p>
            <p className="mt-0.5 font-mono text-sm font-semibold text-slate-800">
              {data.name}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Company</p>
            <p className="mt-0.5 text-sm text-slate-700">
              {data.company?.name ?? '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Created</p>
            <p className="mt-0.5 text-sm text-slate-700">
              {new Date(data.created_at).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}
            </p>
          </div>
        </div>
      </section>

      {/* Permissions Table */}
      <section className="rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-5 py-3">
          <ShieldCheck size={13} className="text-emerald-500" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Module Permissions ({data.role_module_permission.length})
          </h3>
        </div>
        <div className="p-4">
          <DataTable
            columns={permColumns}
            data={data.role_module_permission}
            keyExtractor={(row) => row.id}
            searchFn={(row, query) =>
              row.module.label.toLowerCase().includes(query) ||
              row.module.path.toLowerCase().includes(query)
            }
            searchPlaceholder="Filter modules..."
            pageSize={10}
            pageSizeOptions={[10, 20, 50]}
            emptyTitle="No permissions"
            emptyDescription="No module permissions match your filter."
          />
        </div>
      </section>
    </div>
  );
}
