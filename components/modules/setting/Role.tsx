'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { DataTable } from '@/components/ui/DataTable';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import PopUpDeleteTransactionModal from '@/components/ui/PopUpDeleteModal';
import { useRegisterModule } from '@/hook/useModule';
import type { ModuleProps } from '@/lib/registry';
import { Eye, Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useState } from 'react';

type ListRole = {
    id: number;
    name: string;
    description: string | null;
    created_at: string;
    company: { id: number; name: string } | null;
};

type FormState = { name: string; description: string };
const EMPTY_FORM: FormState = { name: '', description: '' };

export default function Role({
    module,
    permission,
    initialData,
    actionModules,
}: ModuleProps) {
    useRegisterModule({ actionModules, permission, modulePath: module.path });

    const [roles, setRoles] = useState<ListRole[]>((initialData as ListRole[]) ?? []);
    const [error, setError] = useState<string | null>(null);

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<ListRole | null>(null);
    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [deleting, setDeleting] = useState(false);

    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

    const showToast = (msg: string, type: 'success' | 'error') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const fetchRoles = useCallback(async () => {
        try {
            const r = await fetch('/api/setting/role');
            const d = await r.json();
            if (d.error) setError(d.error);
            else setRoles(d.data?.data ?? d.data ?? []);
        } catch (e) {
            setError(String(e));
        }
    }, []);

    const openCreate = () => {
        setEditing(null);
        setForm(EMPTY_FORM);
        setFormError(null);
        setDialogOpen(true);
    };

    const openEdit = (row: ListRole) => {
        setEditing(row);
        setForm({ name: row.name, description: row.description ?? '' });
        setFormError(null);
        setDialogOpen(true);
    };

    const handleSave = async () => {
        if (!form.name.trim()) {
            setFormError('Name is required');
            return;
        }
        setSaving(true);
        setFormError(null);
        try {
            const url = editing ? `/api/setting/role/${editing.id}` : '/api/setting/role';
            const r = await fetch(url, {
                method: editing ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            const d = await r.json();
            if (!r.ok) {
                setFormError(d.error ?? 'Failed to save');
                return;
            }
            showToast(editing ? 'Role updated' : 'Role created', 'success');
            setDialogOpen(false);
            fetchRoles();
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
            const r = await fetch(`/api/setting/role/${deletingId}`, { method: 'DELETE' });
            if (!r.ok) throw new Error('Delete failed');
            setRoles((prev) => prev.filter((role) => role.id !== deletingId));
            showToast('Role deleted', 'success');
        } catch {
            showToast('Delete failed', 'error');
        } finally {
            setDeleting(false);
            setDeletingId(null);
        }
    };

    const columns: DataTableColumn<ListRole>[] = [
        {
            key: 'name',
            header: 'Role',
            cell: (row) => (
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center">
                        <ShieldCheck size={13} className="text-slate-500" />
                    </div>
                    <span className="font-medium text-sm text-slate-800">{row.name}</span>
                </div>
            ),
        },
        {
            key: 'description',
            header: 'Description',
            cell: (row) =>
                row.description ? (
                    <span className="text-sm text-slate-500">{row.description}</span>
                ) : (
                    <span className="text-xs text-muted-foreground italic">—</span>
                ),
        },
        {
            key: 'company',
            header: 'Company',
            cell: (row) =>
                row.company ? (
                    <span className="text-sm text-slate-500">{row.company.name}</span>
                ) : (
                    <span className="text-xs text-muted-foreground italic">No company</span>
                ),
        },
        {
            key: 'created',
            header: 'Created',
            headerClassName: 'text-right',
            cellClassName: 'text-right',
            cell: (row) => (
                <span className="text-xs text-muted-foreground">
                    {new Date(row.created_at).toLocaleDateString()}
                </span>
            ),
        },
        {
            key: 'actions',
            header: '',
            headerClassName: 'w-28',
            cellClassName: 'text-right',
            cell: (row) => (
                <div className="inline-flex items-center gap-1 justify-end">
                    <Link
                        href={`/setting/role/${row.id}`}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                        title="View permissions"
                    >
                        <Eye size={13} />
                    </Link>
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
                            title="Delete"
                        >
                            <Trash2 size={13} />
                        </button>
                    )}
                </div>
            ),
        },
    ];

    return (
        <div className=" mx-auto animate-in fade-in duration-300">
            {toast && (
                <div
                    className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-lg transition-all ${
                        toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
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
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                    <ShieldCheck size={20} className="text-slate-600" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-slate-800">Roles</h2>
                    <p className="text-sm text-slate-500">Manage system roles</p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                    <Badge variant="secondary">
                        {roles.length} role{roles.length !== 1 ? 's' : ''}
                    </Badge>
                    {permission.can_create && (
                        <Button
                            size="sm"
                            onClick={openCreate}
                            className="gap-1.5 bg-emerald-600 hover:bg-emerald-500"
                        >
                            <Plus size={14} /> Add Role
                        </Button>
                    )}
                </div>
            </div>

            {error && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">
                    {error}
                </div>
            )}

            <DataTable
                columns={columns}
                data={roles}
                keyExtractor={(r) => r.id}
                searchFn={(row, q) =>
                    row.name.toLowerCase().includes(q) ||
                    (row.description ?? '').toLowerCase().includes(q)
                }
                searchPlaceholder="Search roles..."
                emptyTitle="No roles yet"
                emptyDescription="Create your first role to get started"
                emptyAction={
                    permission.can_create ? (
                        <Button
                            size="sm"
                            onClick={openCreate}
                            className="gap-1.5 bg-emerald-600 hover:bg-emerald-500"
                        >
                            <Plus size={14} /> Add Role
                        </Button>
                    ) : null
                }
            />

            {/* Create / Edit dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{editing ? 'Edit Role' : 'Create Role'}</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="role-name">
                                Name <span className="text-rose-500">*</span>
                            </Label>
                            <Input
                                id="role-name"
                                placeholder="e.g. admin, staff, viewer"
                                value={form.name}
                                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="role-desc">Description</Label>
                            <Input
                                id="role-desc"
                                placeholder="Optional description"
                                value={form.description}
                                onChange={(e) =>
                                    setForm((f) => ({ ...f, description: e.target.value }))
                                }
                            />
                        </div>
                        {formError && <p className="text-sm text-rose-600">{formError}</p>}
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setDialogOpen(false)}
                            disabled={saving}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={saving}
                            className="bg-emerald-600 hover:bg-emerald-500 min-w-20"
                        >
                            {saving ? (
                                <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                            ) : editing ? (
                                'Save'
                            ) : (
                                'Create'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
