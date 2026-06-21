'use client';

import AsyncSearchSelect from '@/components/ui/AsyncSearchSelect';
import type { PopUpSearchTableColumn } from '@/components/ui/PopUpSearchTable';
import { Button } from '@/components/ui/button';
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

function PermToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`h-5 w-5 rounded border-2 transition-colors flex items-center justify-center ${
        checked
          ? 'border-emerald-500 bg-emerald-500 text-white'
          : 'border-slate-300 bg-white hover:border-slate-400'
      }`}
    >
      {checked && (
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
          <path
            d="M2.5 6L5 8.5L9.5 3.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}

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
  const [search, setSearch] = useState('');

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

  const filteredPerms = permissions.filter(
    (p) =>
      !search ||
      p.label.toLowerCase().includes(search.toLowerCase()) ||
      p.path.toLowerCase().includes(search.toLowerCase()),
  );

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
      <section className="">
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 bg-slate-50/80 px-5 py-3">
          <div className="flex items-center gap-2">
            <ShieldCheck size={13} className="text-emerald-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Module Permissions ({permissions.length})
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
          <table className="w-full">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Module
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Path
                </th>
                {PERM_FIELDS.map((f) => (
                  <th
                    key={f}
                    className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-400"
                  >
                    {PERM_LABELS[f]}
                  </th>
                ))}
                <th className="w-10 px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredPerms.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    {search
                      ? 'No modules match your filter.'
                      : 'No permissions yet.'}
                  </td>
                </tr>
              )}
              {filteredPerms.map((perm) => (
                <tr key={perm.module_id} className="hover:bg-slate-50/50">
                  <td className="px-5 py-3 text-slate-800">{perm.label}</td>
                  <td className="px-5 py-3 font-mono text-xs text-slate-400">
                    {perm.path || '—'}
                  </td>
                  {PERM_FIELDS.map((f) => (
                    <td key={f} className="px-5 py-3 text-center">
                      <PermToggle
                        checked={perm[f]}
                        onChange={() => togglePerm(perm.module_id, f)}
                      />
                    </td>
                  ))}
                  <td className="px-3 py-3 text-center">
                    <button
                      type="button"
                      onClick={() => removeModule(perm.module_id)}
                      className="text-slate-300 transition-colors hover:text-red-400"
                      title="Remove"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
                  <PermToggle
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
