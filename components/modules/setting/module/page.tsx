'use client';

import { ButtonActionStaticRender } from '@/components/ui/button-action';
import { DataTable } from '@/components/ui/DataTable';
import PopUpDeleteTransactionModal from '@/components/ui/PopUpDeleteModal';
import { useRegisterModule } from '@/hook/useModule';
import { usePageActions } from '@/hook/usePageAction';
import type { ModuleProps } from '@/lib/registry';
import type { AppModule, TMeta } from '@/types/app';
import { useState } from 'react';
import { getModuleColumns } from './columns';

const DEFAULT_META: TMeta = { total: 0, page: 1, limit: 10, totalPages: 0 };

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

    const apiBase = `/api${currentPath.path}`;

    const [tableData, setTableData] = useState<AppModule[]>((initialData as AppModule[]) ?? []);
    const [tableMeta, setTableMeta] = useState<TMeta>(initialMeta ?? DEFAULT_META);

    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

    const fetchPage = async (page: number, limit: number) => {
        const res = await fetch(`${apiBase}?page=${page}&limit=${limit}`);
        if (res.ok) {
            const json = await res.json();
            setTableData(json.data ?? []);
            setTableMeta(json.meta ?? DEFAULT_META);
        }
    };

    const onConfirmDelete = async () => {
        if (!deletingId) return;
        try {
            setIsDeleting(true);
            const res = await fetch(`${apiBase}/${deletingId}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Delete failed');
            setToast({ msg: 'Module deleted successfully', type: 'success' });
            await fetchPage(tableMeta.page, tableMeta.limit);
        } catch {
            setToast({ msg: 'Failed to delete module', type: 'error' });
        } finally {
            setIsDeleting(false);
            setDeletingId(null);
        }
    };

    const columns = getModuleColumns({ dynamicActions, onDelete: setDeletingId });

    return (
        <main>
            {toast && (
                <div
                    className={`fixed right-4 top-4 z-50 rounded-xl px-4 py-3 text-sm font-medium shadow-lg transition-all ${
                        toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
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

            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="space-y-1">
                </div>
                <div className="flex items-center">
                    {staticActions.map((action) => (
                        <span key={action.href}>
                            {ButtonActionStaticRender(action, false)}
                        </span>
                    ))}
                </div>
            </div>

            <DataTable<AppModule>
                columns={columns}
                data={tableData}
                keyExtractor={(row) => row.id}
                searchFn={(row, query) =>
                    row.key.toLowerCase().includes(query) ||
                    row.label.toLowerCase().includes(query) ||
                    row.path.toLowerCase().includes(query)
                }
                searchPlaceholder="Search by key, label, or path..."
                pageSize={tableMeta.limit}
                pageSizeOptions={[10, 20, 50]}
                serverSide={{
                    total: tableMeta.total,
                    page: tableMeta.page,
                    totalPages: tableMeta.totalPages,
                    onPageChange: (p) => fetchPage(p, tableMeta.limit),
                    onPageSizeChange: (limit) => fetchPage(1, limit),
                }}
                emptyTitle="No modules found"
                emptyDescription="No modules match your search criteria"
                className=""
            />
        </main>
    );
}
