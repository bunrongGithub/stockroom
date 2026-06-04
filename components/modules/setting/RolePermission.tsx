'use client';

import { DataTable } from '@/components/ui/DataTable';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/button';
import {
    Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import PopUpDeleteTransactionModal from '@/components/ui/PopUpDeleteModal';
import type { ModuleProps } from '@/lib/module-registry';
import type { AppModuleType } from '@/types/app';
import { Check, KeyRound, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────

type PermissionRow = {
    id: number;
    role_id: number;
    module_id: number;
    can_view: boolean;
    can_create: boolean;
    can_update: boolean;
    can_delete: boolean;
    can_export: boolean;
    created_at: string;
    roles: { id: number; name: string } | null;
    modules: { id: number; label: string; path: string; type: string } | null;
};

type RoleOption = { id: number; name: string };
type ModuleOption = { id: number; label: string; path: string; type: string; key: string };

type FormState = {
    role_id: string;
    module_id: string;
    module_type: AppModuleType;
    can_view: boolean;
    can_create: boolean;
    can_update: boolean;
    can_delete: boolean;
    can_export: boolean;
};

const EMPTY_FORM: FormState = {
    role_id: '',
    module_id: '',
    module_type: 'transaction',
    can_view: false,
    can_create: false,
    can_update: false,
    can_delete: false,
    can_export: false,
};

// ── Helpers ────────────────────────────────────────────────────────────────

const TYPE_STYLE: Record<string, string> = {
    transaction:   'bg-emerald-100 text-emerald-700 border-emerald-200',
    configuration: 'bg-sky-100    text-sky-700    border-sky-200',
    action:        'bg-slate-100  text-slate-600  border-slate-200',
};

const PERM_KEYS = ['can_view', 'can_create', 'can_update', 'can_delete', 'can_export'] as const;
const PERM_LABELS: Record<typeof PERM_KEYS[number], string> = {
    can_view: 'View', can_create: 'Create', can_update: 'Update',
    can_delete: 'Delete', can_export: 'Export',
};

function PermDot({ active }: { active: boolean }) {
    return active ? (
        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-600">
            <Check size={10} strokeWidth={3} />
        </span>
    ) : (
        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 text-slate-300">
            <X size={10} strokeWidth={3} />
        </span>
    );
}

function PermToggle({
    label,
    checked,
    onChange,
}: {
    label: string;
    checked: boolean;
    onChange: (v: boolean) => void;
}) {
    return (
        <button
            type="button"
            onClick={() => onChange(!checked)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all select-none ${
                checked
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                    : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
            }`}
        >
            <span className={`w-4 h-4 rounded flex items-center justify-center border ${checked ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 bg-white'}`}>
                {checked && <Check size={10} className="text-white" strokeWidth={3} />}
            </span>
            {label}
        </button>
    );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function RolePermission({ permission }: ModuleProps) {
    const [permissions, setPermissions] = useState<PermissionRow[]>([]);
    const [roles, setRoles] = useState<RoleOption[]>([]);
    const [modules, setModules] = useState<ModuleOption[]>([]);
    const [loading, setLoading] = useState(true);

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [deleting, setDeleting] = useState(false);

    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

    // Module type filter for the module dropdown
    const [moduleTypeFilter, setModuleTypeFilter] = useState<string>('all');

    const showToast = (msg: string, type: 'success' | 'error') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            const [pRes, rRes, mRes] = await Promise.all([
                fetch('/api/setting/role-permissions'),
                fetch('/api/setting/roles'),
                fetch('/api/setting/modules'),
            ]);
            const [pData, rData, mData] = await Promise.all([
                pRes.json(), rRes.json(), mRes.json(),
            ]);
            setPermissions(pData.data ?? []);
            setRoles(rData.data ?? []);
            setModules(mData.data ?? []);
        } catch (e) {
            showToast(String(e), 'error');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const openAssign = () => {
        setEditingId(null);
        setForm(EMPTY_FORM);
        setFormError(null);
        setModuleTypeFilter('all');
        setDialogOpen(true);
    };

    const openEdit = (row: PermissionRow) => {
        setEditingId(row.id);
        setForm({
            role_id: String(row.role_id),
            module_id: String(row.module_id),
            module_type: (row.modules?.type ?? 'transaction') as AppModuleType,
            can_view: row.can_view,
            can_create: row.can_create,
            can_update: row.can_update,
            can_delete: row.can_delete,
            can_export: row.can_export,
        });
        setFormError(null);
        setModuleTypeFilter(row.modules?.type ?? 'all');
        setDialogOpen(true);
    };

    const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
        setForm((f) => ({ ...f, [key]: value }));

    // When module changes, auto-fill current module type
    const handleModuleChange = (moduleId: string) => {
        const mod = modules.find((m) => String(m.id) === moduleId);
        setForm((f) => ({
            ...f,
            module_id: moduleId,
            module_type: (mod?.type ?? 'transaction') as AppModuleType,
        }));
    };

    const handleSave = async () => {
        if (!form.role_id || !form.module_id) {
            setFormError('Please select both a role and a module');
            return;
        }
        setSaving(true);
        setFormError(null);
        try {
            const url = editingId
                ? `/api/setting/role-permissions/${editingId}`
                : '/api/setting/role-permissions';
            const method = editingId ? 'PUT' : 'POST';
            const r = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            const d = await r.json();
            if (!r.ok) { setFormError(d.error ?? 'Failed to save'); return; }
            showToast(editingId ? 'Permission updated' : 'Permission assigned', 'success');
            setDialogOpen(false);
            fetchAll();
        } catch (e) {
            setFormError(String(e));
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deletingId) return;
        setDeleting(true);
        try {
            const r = await fetch(`/api/setting/role-permissions/${deletingId}`, { method: 'DELETE' });
            if (!r.ok) throw new Error('Delete failed');
            showToast('Permission removed', 'success');
            fetchAll();
        } catch {
            showToast('Delete failed', 'error');
        } finally {
            setDeleting(false);
            setDeletingId(null);
        }
    };

    const filteredModules = moduleTypeFilter === 'all'
        ? modules
        : modules.filter((m) => m.type === moduleTypeFilter);

    // ── Columns ──────────────────────────────────────────────────────────────

    const columns: DataTableColumn<PermissionRow>[] = [
        {
            key: 'role',
            header: 'Role',
            cell: (row) => (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                    {row.roles?.name ?? '—'}
                </span>
            ),
        },
        {
            key: 'module',
            header: 'Module',
            cell: (row) => (
                <div>
                    <p className="text-sm font-medium text-slate-800">{row.modules?.label ?? '—'}</p>
                    <p className="text-xs text-slate-400 font-mono">{row.modules?.path}</p>
                </div>
            ),
        },
        {
            key: 'type',
            header: 'Type',
            cell: (row) => {
                const t = row.modules?.type ?? 'transaction';
                return (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${TYPE_STYLE[t] ?? TYPE_STYLE.transaction}`}>
                        {t}
                    </span>
                );
            },
        },
        {
            key: 'permissions',
            header: 'Permissions',
            cell: (row) => (
                <div className="flex items-center gap-1" title={PERM_KEYS.filter(k => row[k]).map(k => PERM_LABELS[k]).join(', ')}>
                    {PERM_KEYS.map((k) => (
                        <span key={k} title={PERM_LABELS[k]}>
                            <PermDot active={row[k]} />
                        </span>
                    ))}
                    <span className="ml-1 text-xs text-slate-400">
                        {PERM_KEYS.filter((k) => row[k]).length}/{PERM_KEYS.length}
                    </span>
                </div>
            ),
        },
        {
            key: 'actions',
            header: '',
            headerClassName: 'w-20',
            cellClassName: 'text-right',
            cell: (row) => (
                <div className="inline-flex items-center gap-1 justify-end">
                    {permission.can_update && (
                        <button
                            type="button"
                            onClick={() => openEdit(row)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors"
                            title="Edit"
                        >
                            <Pencil size={13} />
                        </button>
                    )}
                    {permission.can_delete && (
                        <button
                            type="button"
                            onClick={() => setDeletingId(row.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title="Remove"
                        >
                            <Trash2 size={13} />
                        </button>
                    )}
                </div>
            ),
        },
    ];

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6 animate-in fade-in duration-300">
            {/* Toast */}
            {toast && (
                <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-lg ${toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
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
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                    <KeyRound size={20} className="text-amber-600" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-slate-800">Module Permissions</h2>
                    <p className="text-sm text-slate-500">Assign permissions to roles for each module</p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                    {!loading && (
                        <Badge variant="secondary">{permissions.length} assignment{permissions.length !== 1 ? 's' : ''}</Badge>
                    )}
                    {permission.can_create && (
                        <Button size="sm" onClick={openAssign} className="gap-1.5 bg-emerald-600 hover:bg-emerald-500">
                            <Plus size={14} /> Assign Permission
                        </Button>
                    )}
                </div>
            </div>

            {/* Permission legend */}
            <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs text-slate-400 font-medium uppercase tracking-wide">Legend:</span>
                {PERM_KEYS.map((k) => (
                    <span key={k} className="flex items-center gap-1 text-xs text-slate-500">
                        <PermDot active={true} /> {PERM_LABELS[k]}
                    </span>
                ))}
            </div>

            {loading ? (
                <div className="flex justify-center py-16">
                    <div className="w-6 h-6 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
                </div>
            ) : (
                <DataTable
                    columns={columns}
                    data={permissions}
                    keyExtractor={(r) => r.id}
                    searchFn={(row, q) =>
                        (row.roles?.name ?? '').toLowerCase().includes(q) ||
                        (row.modules?.label ?? '').toLowerCase().includes(q) ||
                        (row.modules?.path ?? '').toLowerCase().includes(q)
                    }
                    searchPlaceholder="Search by role or module..."
                    emptyTitle="No permissions assigned"
                    emptyDescription="Use 'Assign Permission' to grant a role access to a module"
                    emptyAction={
                        permission.can_create ? (
                            <Button size="sm" onClick={openAssign} className="gap-1.5 bg-emerald-600 hover:bg-emerald-500">
                                <Plus size={14} /> Assign Permission
                            </Button>
                        ) : null
                    }
                />
            )}

            {/* Assign / Edit dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <KeyRound size={16} className="text-amber-500" />
                            {editingId ? 'Edit Permission' : 'Assign Permission'}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-5 py-2">
                        {/* Role */}
                        <div className="space-y-1.5">
                            <Label>Role <span className="text-rose-500">*</span></Label>
                            <Select
                                value={form.role_id}
                                onValueChange={(v) => setField('role_id', v)}
                                disabled={!!editingId}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a role…" />
                                </SelectTrigger>
                                <SelectContent>
                                    {roles.map((r) => (
                                        <SelectItem key={r.id} value={String(r.id)}>
                                            {r.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Module with type filter */}
                        <div className="space-y-1.5">
                            <Label>Module <span className="text-rose-500">*</span></Label>
                            <div className="flex gap-2">
                                {/* Type filter */}
                                <Select value={moduleTypeFilter} onValueChange={setModuleTypeFilter}>
                                    <SelectTrigger className="w-40 shrink-0">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All types</SelectItem>
                                        <SelectItem value="transaction">Transaction</SelectItem>
                                        <SelectItem value="configuration">Configuration</SelectItem>
                                        <SelectItem value="action">Action</SelectItem>
                                    </SelectContent>
                                </Select>
                                {/* Module picker */}
                                <Select
                                    value={form.module_id}
                                    onValueChange={handleModuleChange}
                                    disabled={!!editingId}
                                >
                                    <SelectTrigger className="flex-1 min-w-0">
                                        <SelectValue placeholder="Select a module…" />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-56">
                                        {filteredModules.map((m) => (
                                            <SelectItem key={m.id} value={String(m.id)}>
                                                <span className="font-medium">{m.label}</span>
                                                <span className="ml-1 text-xs text-muted-foreground font-mono">{m.path}</span>
                                            </SelectItem>
                                        ))}
                                        {filteredModules.length === 0 && (
                                            <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                                                No modules for this type
                                            </div>
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Module type */}
                        <div className="space-y-1.5">
                            <Label>Module Display Type</Label>
                            <div className="flex gap-2">
                                {(['transaction', 'configuration', 'action'] as AppModuleType[]).map((t) => (
                                    <button
                                        key={t}
                                        type="button"
                                        onClick={() => setField('module_type', t)}
                                        className={`flex-1 py-1.5 rounded-lg border text-xs font-medium transition-all capitalize ${
                                            form.module_type === t
                                                ? TYPE_STYLE[t]
                                                : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                                        }`}
                                    >
                                        {t}
                                    </button>
                                ))}
                            </div>
                            <p className="text-xs text-slate-400">
                                <strong>transaction</strong> → sidebar &nbsp;·&nbsp;
                                <strong>configuration</strong> → top navbar &nbsp;·&nbsp;
                                <strong>action</strong> → hidden from nav
                            </p>
                        </div>

                        {/* Permissions */}
                        <div className="space-y-2">
                            <Label>Permissions</Label>
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                {PERM_KEYS.map((k) => (
                                    <PermToggle
                                        key={k}
                                        label={PERM_LABELS[k]}
                                        checked={form[k]}
                                        onChange={(v) => setField(k, v)}
                                    />
                                ))}
                            </div>
                            {/* Quick select */}
                            <div className="flex gap-2 pt-1">
                                <button
                                    type="button"
                                    className="text-xs text-emerald-600 hover:underline"
                                    onClick={() => setForm((f) => ({ ...f, can_view: true, can_create: true, can_update: true, can_delete: true, can_export: true }))}
                                >
                                    Select all
                                </button>
                                <span className="text-slate-300">·</span>
                                <button
                                    type="button"
                                    className="text-xs text-slate-500 hover:underline"
                                    onClick={() => setForm((f) => ({ ...f, can_view: false, can_create: false, can_update: false, can_delete: false, can_export: false }))}
                                >
                                    Clear all
                                </button>
                            </div>
                        </div>

                        {formError && (
                            <p className="text-sm text-rose-600 rounded-lg bg-rose-50 px-3 py-2">{formError}</p>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                            Cancel
                        </Button>
                        <Button onClick={handleSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-500 min-w-24">
                            {saving ? (
                                <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                            ) : (
                                editingId ? 'Save Changes' : 'Assign'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
