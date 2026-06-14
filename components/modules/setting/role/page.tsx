'use client';

import { Button } from '@/components/ui/button';
import {
    ButtonActionDynamicRender,
    ButtonActionStaticRender,
} from '@/components/ui/button-action';
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
import { usePageActions } from '@/hook/usePageAction';
import type { ModuleProps } from '@/lib/registry';
import { Plus, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { getRoleColumns, TRole } from './columns';

type EmptyForm = {
    name: string;
    description: string;
    company_id: number | null;
};
const emptyForm: EmptyForm = { name: '', description: '', company_id: null };
export default function Role({
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

    const [data, setData] = useState<TRole[]>((initialData as TRole[]) ?? []);

    const apiBase = pageAction.actions.find(
        (item) => item.label.toLocaleLowerCase() === 'create',
    )?.key!;

    const [dialogOpen, setDialogOpen] = useState(false);
    const [form, setForm] = useState<EmptyForm>(emptyForm);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

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

    const openCreate = () => {
        setForm(emptyForm);
        setFormError(null);
        setDialogOpen(true);
    };

    const loadData = async () => {
        const res = await fetch(apiBase);
        if (res.ok) {
            const json = await res.json();
            setData(json.data ?? []);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setFormError(null);
        try {
            const res = await fetch(apiBase, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });

            const json = await res.json();

            if (!res.ok) {
                const msg = json.details
                    ? Object.values(json.details as Record<string, string[]>)
                          .flat()
                          .join(', ')
                    : (json.error ?? 'Save failed');
                setFormError(msg);
                return;
            }

            await loadData();
            setDialogOpen(false);
            showToast('Role saved successfully', 'success');
        } catch {
            setFormError('An unexpected error occurred');
        } finally {
            setSaving(false);
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
            setData((prev) => prev.filter((role) => role.id !== deletingId));
            showToast('Role deleted', 'success');
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
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="space-y-1">
                    <h2 className="text-2xl font-bold text-slate-800">Role</h2>
                    <p className="text-sm text-slate-500">Role in your App </p>
                </div>
                <div className="flex items-center gap-2">
                    {staticActions.map((action) => {
                        const Icon = action.icon;
                        return (
                            <span key={action.href}>
                                {ButtonActionStaticRender(action, true, () =>
                                    setDialogOpen(true),
                                )}
                            </span>
                        );
                    })}
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
                <DialogContent className="sm:max-w-md border-none">
                    <DialogHeader>
                        <DialogTitle>Role</DialogTitle>
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
                                onChange={(e) =>
                                    setForm((f) => ({
                                        ...f,
                                        name: e.target.value,
                                    }))
                                }
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="role-desc">Description</Label>
                            <Input
                                id="role-desc"
                                placeholder="Optional description"
                                value={form.description}
                                onChange={(e) =>
                                    setForm((f) => ({
                                        ...f,
                                        description: e.target.value,
                                    }))
                                }
                            />
                        </div>
                        {formError && (
                            <p className="text-sm text-rose-600">{formError}</p>
                        )}
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
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
