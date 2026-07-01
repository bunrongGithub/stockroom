'use client';

import AsyncSearchSelect from '@/components/ui/AsyncSearchSelect';
import { Check } from '@/components/ui/Check';
import type { PopUpSearchTableColumn } from '@/components/ui/PopUpSearchTable';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRegisterModule } from '@/hook/useModule';
import type { ModuleProps } from '@/lib/registry';
import {
  ArrowLeft,
  Loader2,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type PermRow = {
  module_id: number;
  label: string;
  path: string;
  can_view: boolean;
  can_create: boolean;
  can_update: boolean;
  can_delete: boolean;
};

type ModuleLookupRow = {
  id: number;
  label: string;
  key: string;
  path: string;
  type: string;
} & Record<string, unknown>;

type RoleDetail = {
  id: number;
  name: string;
  description: string | null;
  company: { id: number; name: string } | null;
  role_module_permission: {
    id: number;
    can_view: boolean;
    can_create: boolean;
    can_update: boolean;
    can_delete: boolean;
    module: { id: number; key: string; path: string; label: string };
  }[];
};

const PERM_FIELDS = [
  'can_view',
  'can_create',
  'can_update',
  'can_delete',
] as const;
type PermField = (typeof PERM_FIELDS)[number];
const PERM_LABELS: Record<PermField, string> = {
  can_view: 'View',
  can_create: 'Create',
  can_update: 'Update',
  can_delete: 'Delete',
};

export default function Update({
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
  const router = useRouter();
  const id = Number(
    Array.isArray(params.slug) ? params.slug.at(-2) : params.slug,
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saveError, setSaveError] = useState('');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [permissions, setPermissions] = useState<PermRow[]>([]);

  // New module picker state
  const [newModule, setNewModule] = useState<{
    id: number;
    label: string;
  } | null>(null);
  const [newPerms, setNewPerms] = useState<Record<PermField, boolean>>({
    can_view: true,
    can_create: false,
    can_update: false,
    can_delete: false,
  });

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/setting/role/${id}`)
      .then((r) => r.json())
      .then((json: RoleDetail) => {
        setName(json.name ?? '');
        setDescription(json.description ?? '');
        setPermissions(
          json.role_module_permission.map((p) => ({
            module_id: p.module.id,
            label: p.module.label,
            path: p.module.path,
            can_view: p.can_view,
            can_create: p.can_create,
            can_update: p.can_update,
            can_delete: p.can_delete,
          })),
        );
      })
      .catch(() => setError('Failed to load role.'))
      .finally(() => setLoading(false));
  }, [id]);

  const togglePerm = (moduleId: number, field: PermField) => {
    setPermissions((prev) =>
      prev.map((p) =>
        p.module_id === moduleId ? { ...p, [field]: !p[field] } : p,
      ),
    );
  };

  const removeModule = (moduleId: number) => {
    setPermissions((prev) => prev.filter((p) => p.module_id !== moduleId));
  };

  const addModule = () => {
    if (!newModule) return;
    if (permissions.some((p) => p.module_id === newModule.id)) {
      setNewModule(null);
      return;
    }
    setPermissions((prev) => [
      ...prev,
      {
        module_id: newModule.id,
        label: newModule.label,
        path: '',
        ...newPerms,
      },
    ]);
    setNewModule(null);
    setNewPerms({
      can_view: true,
      can_create: false,
      can_update: false,
      can_delete: false,
    });
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setSaveError('Name is required.');
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      const [resRole, resPerms] = await Promise.all([
        fetch(`/api/setting/role/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim() || null,
          }),
        }),
        fetch(`/api/setting/role/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ permissions }),
        }),
      ]);

      if (!resRole.ok) {
        const j = await resRole.json();
        setSaveError(j.error ?? 'Failed to save role.');
        return;
      }
      if (!resPerms.ok) {
        const j = await resPerms.json();
        setSaveError(j.error ?? 'Failed to save permissions.');
        return;
      }

      router.push(`/setting/role/${id}/view`);
    } catch {
      setSaveError('An unexpected error occurred.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <Loader2 size={18} className="animate-spin mr-2" /> Loading...
      </div>
    );
  }

  if (error) {
    return <p className="py-10 text-center text-red-500">{error}</p>;
  }

  const popUpColumns: PopUpSearchTableColumn<ModuleLookupRow>[] = [
    {
      key: 'id',
      header: '#',
      className: 'w-16 text-muted-foreground',
    },
    {
      key: 'label',
      header: 'Module',
      filterable: true,
      getValue: (row: ModuleLookupRow) => row.label,
    },
    {
      key: 'type',
      header: 'Type',
      className: 'w-28',
    },
    {
      key: 'path',
      header: 'Path',
      className: 'font-mono text-xs',
      getValue: (row: ModuleLookupRow) => row.path,
    },
  ];

  const permColumns: DataTableColumn<PermRow>[] = [
    {
      key: 'label',
      header: 'Module',
      cell: (row) => <span className="text-slate-800">{row.label}</span>,
    },
    {
      key: 'path',
      header: 'Path',
      cell: (row) => <span className="font-mono text-xs text-slate-400">{row.path || '—'}</span>,
    },
    {
      key: 'can_view',
      header: 'View',
      headerClassName: 'text-center',
      cellClassName: 'text-center',
      cell: (row) => <Check checked={row.can_view} onChange={() => togglePerm(row.module_id, 'can_view')} />,
    },
    {
      key: 'can_create',
      header: 'Create',
      headerClassName: 'text-center',
      cellClassName: 'text-center',
      cell: (row) => <Check checked={row.can_create} onChange={() => togglePerm(row.module_id, 'can_create')} />,
    },
    {
      key: 'can_update',
      header: 'Update',
      headerClassName: 'text-center',
      cellClassName: 'text-center',
      cell: (row) => <Check checked={row.can_update} onChange={() => togglePerm(row.module_id, 'can_update')} />,
    },
    {
      key: 'can_delete',
      header: 'Delete',
      headerClassName: 'text-center',
      cellClassName: 'text-center',
      cell: (row) => <Check checked={row.can_delete} onChange={() => togglePerm(row.module_id, 'can_delete')} />,
    },
    {
      key: 'remove',
      header: '',
      headerClassName: 'w-10',
      cellClassName: 'text-center',
      cell: (row) => (
        <button
          type="button"
          onClick={() => removeModule(row.module_id)}
          className="text-slate-300 transition-colors hover:text-red-400"
          title="Remove"
        >
          <Trash2 size={13} />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-4 font-mono text-xs rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href={`/setting/role/${id}/view`}
            className="inline-flex items-center gap-1.5 text-slate-500 transition-colors hover:text-slate-700"
          >
            <ArrowLeft size={14} /> Back to Role
          </Link>
          <h2 className="mt-2 flex items-center gap-2 text-xl font-bold text-slate-800">
            <ShieldCheck className="text-emerald-500" size={20} />
            Edit Role
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/setting/role/${id}/view`}
            className="rounded-lg border border-slate-200 px-4 py-2 text-slate-600 transition-colors hover:bg-slate-50"
          >
            Cancel
          </Link>
          <Button onClick={handleSave} disabled={saving} size="sm">
            {saving ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Save size={13} />
            )}
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {saveError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          {saveError}
        </div>
      )}

      {/* Role Info */}
      <section className="">
        <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-400">
          Role Info
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="role-name">
              Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="role-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. admin, staff, viewer"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="role-desc">Description</Label>
            <Input
              id="role-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
            />
          </div>
        </div>
      </section>

      {/* Permissions */}
      <section className="rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-5 py-3">
          <ShieldCheck size={13} className="text-emerald-500" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Module Permissions ({permissions.length})
          </h3>
        </div>
        <div className="p-4">
          <DataTable
            columns={permColumns}
            data={permissions}
            keyExtractor={(row) => row.module_id}
            searchFn={(row, query) =>
              row.label.toLowerCase().includes(query) ||
              row.path.toLowerCase().includes(query)
            }
            searchPlaceholder="Filter modules..."
            pageSize={10}
            pageSizeOptions={[10, 20, 50]}
            emptyTitle="No permissions"
            emptyDescription="No permissions yet. Add a module below."
          />
        </div>

        {/* Add New Module Row */}
        <div className="border-t border-slate-100 bg-slate-50/40 px-5 py-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Add Module Permission
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-60 flex-1">
              <AsyncSearchSelect
                label=""
                placeholder="Search module to add..."
                apiUrl="/api/setting/module/lookup"
                nameKey="label"
                value={newModule?.id ?? null}
                selectedLabel={newModule?.label ?? ''}
                enablePopupSearch
                popUpColumns={popUpColumns}
                popupPageSize={10}
                onChangeAction={(selected) => {
                  if (!selected?.id) {
                    setNewModule(null);
                    return;
                  }
                  setNewModule({
                    id: Number(selected.id),
                    label: selected.name,
                  });
                }}
              />
            </div>
            <div className="flex items-center gap-3 pb-0.5">
              {PERM_FIELDS.map((f) => (
                <label
                  key={f}
                  className="flex flex-col items-center gap-1 cursor-pointer"
                >
                  <span className="text-[10px] font-semibold uppercase text-slate-400">
                    {PERM_LABELS[f]}
                  </span>
                  <Check
                    checked={newPerms[f]}
                    onChange={() =>
                      setNewPerms((prev) => ({ ...prev, [f]: !prev[f] }))
                    }
                  />
                </label>
              ))}
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={addModule}
              disabled={!newModule}
            >
              <Plus size={13} /> Add
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
