'use client';

import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import PopUpDeleteTransactionModal from '@/components/ui/PopUpDeleteModal';
import { usePageActions } from '@/hook/usePageAction';
import type { ModuleProps } from '@/lib/module-registry';
import type { TMeta } from '@/types/app';
import type { AppModule } from '@/types/app';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

const DEFAULT_META: TMeta = { total: 0, page: 1, limit: 10, totalPages: 0 };

export default function ModuleComponent({ module, permission, initialData, initialMeta }: ModuleProps) {
    const { setActions } = usePageActions();

    const displayModules = (initialData as AppModule[]) ?? [];
    const displayMeta = initialMeta ?? DEFAULT_META;

    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

    // Setup page actions
    useEffect(() => {
        const actions = [];
        if (permission.can_create) {
            actions.push({
                label: 'Add Module',
                href: `${module.path}/create`,
                type: 'user_action' as const,
                dynamic: false,
                icon: Plus,
            });
        }
        if (permission.can_update) {
            actions.push({
                label: 'Edit',
                href: `${module.path}/:id/update`,
                type: 'user_action' as const,
                dynamic: true,
                icon: Pencil,
            });
        }
        if (permission.can_delete) {
            actions.push({
                label: 'Delete',
                href: null,
                type: 'user_action' as const,
                dynamic: true,
                icon: Trash2,
            });
        }
        setActions(actions);
        return () => setActions([]);
    }, [module.path, permission, setActions]);

    // Delete handler
    const onConfirmDelete = async () => {
        if (!deletingId) return;
        try {
            setIsDeleting(true);
            const res = await fetch(`/api/modules/${deletingId}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Delete failed');
            setToast({ msg: 'Module deleted successfully', type: 'success' });
            window.location.reload();
        } catch {
            setToast({ msg: 'Failed to delete module', type: 'error' });
        } finally {
            setIsDeleting(false);
            setDeletingId(null);
        }
    };


    // DataTable columns
    const columns: DataTableColumn<AppModule>[] = [
        {
            key: 'key',
            header: 'Key',
            cell: (row) => <span className="font-mono text-xs">{row.key}</span>,
        },
        {
            key: 'label',
            header: 'Label',
            cell: (row) => <span className="font-medium">{row.label}</span>,
        },
        {
            key: 'path',
            header: 'Path',
            cell: (row) => <span className="text-xs text-muted-foreground">{row.path}</span>,
        },
        {
            key: 'type',
            header: 'Type',
            cell: (row) => (
                <span className="inline-block rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-800">
                    {row.type}
                </span>
            ),
        },
        {
            key: 'status',
            header: 'Status',
            cell: (row) => (
                <span
                    className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${
                        row.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                    }`}
                >
                    {row.is_active ? 'Active' : 'Inactive'}
                </span>
            ),
        },
        {
            key: 'actions',
            header: 'Actions',
            cell: (row) => (
                <div className="flex items-center gap-2">
                    {permission.can_update && (
                        <Link
                            href={`${module.path}/${row.id}/update`}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 px-3 py-1.5 text-xs font-medium text-sky-600 transition-colors hover:bg-sky-50"
                        >
                            <Pencil size={13} />
                            Edit
                        </Link>
                    )}
                    {permission.can_delete && (
                        <button
                            onClick={() => setDeletingId(row.id)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-50"
                        >
                            <Trash2 size={13} />
                            Delete
                        </button>
                    )}
                </div>
            ),
        },
    ];

    return (
        <main className="space-y-6 p-4 md:p-8">
            {/* Toast */}
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

            {/* Header */}
            <div className="space-y-2">
                <h2 className="text-2xl font-bold text-slate-800">Modules</h2>
                <p className="text-sm text-slate-500">Manage application modules and their access control</p>
            </div>

            {/* DataTable */}
            <DataTable<AppModule>
                columns={columns}
                data={displayModules}
                keyExtractor={(row) => row.id}
                searchFn={(row, query) =>
                    row.key.toLowerCase().includes(query) ||
                    row.label.toLowerCase().includes(query) ||
                    row.path.toLowerCase().includes(query)
                }
                searchPlaceholder="Search by key, label, or path..."
                pageSize={displayMeta.limit}
                pageSizeOptions={[10, 20, 50]}
                emptyTitle="No modules found"
                emptyDescription="No modules match your search criteria"
                className=""
            />

            {/* Pagination info (server-side aware) */}
            {displayMeta.total > 0 && (
                <div className="flex items-center justify-between text-xs text-slate-500">
                    <p>
                        Showing{' '}
                        <span className="font-semibold text-slate-700">
                            {(displayMeta.page - 1) * displayMeta.limit + 1}
                        </span>
                        {' – '}
                        <span className="font-semibold text-slate-700">
                            {Math.min(displayMeta.page * displayMeta.limit, displayMeta.total)}
                        </span>{' '}
                        of{' '}
                        <span className="font-semibold text-slate-700">{displayMeta.total}</span>{' '}
                        modules
                    </p>
                    <span className="text-sm">
                        Page {displayMeta.page} of {displayMeta.totalPages}
                    </span>
                </div>
            )}
        </main>
    );
}
