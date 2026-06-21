'use client';

import { Button } from '@/components/ui/button';
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
  const [search, setSearch] = useState('');

  const editPageAction = currentPathActions?.find((action) =>
    action.path.endsWith('/update'),
  );


  console.log(currentPath)
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

  const filteredPerms = data.role_module_permission.filter(
    (p) =>
      !search ||
      p.module.label.toLowerCase().includes(search.toLowerCase()) ||
      p.module.path.toLowerCase().includes(search.toLowerCase()),
  );

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
      <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 bg-slate-50/80 px-5 py-3">
          <div className="flex items-center gap-2">
            <ShieldCheck size={13} className="text-emerald-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Module Permissions ({data.role_module_permission.length})
            </h3>
          </div>
          <input
            type="text"
            placeholder="Filter modules..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-7 rounded-lg border border-slate-200 bg-white px-3 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-400"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Module
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Path
                </th>
                <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-400">
                  View
                </th>
                <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Create
                </th>
                <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Update
                </th>
                <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Delete
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredPerms.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-8 text-center text-sm text-slate-400"
                  >
                    No modules match your filter.
                  </td>
                </tr>
              ) : (
                filteredPerms.map((perm) => (
                  <tr key={perm.id} className="hover:bg-slate-50/50">
                    <td className="px-5 py-3 font-medium text-slate-800">
                      {perm.module.label}
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-slate-400">
                      {perm.module.path}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <PermBadge granted={perm.can_view} />
                    </td>
                    <td className="px-5 py-3 text-center">
                      <PermBadge granted={perm.can_create} />
                    </td>
                    <td className="px-5 py-3 text-center">
                      <PermBadge granted={perm.can_update} />
                    </td>
                    <td className="px-5 py-3 text-center">
                      <PermBadge granted={perm.can_delete} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
