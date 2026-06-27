'use client';

import StockForm from '@/components/forms/inventory/stock/StockForm';
import PopUpDeleteTransactionModal from '@/components/ui/PopUpDeleteModal';
import { useRegisterModule } from '@/hook/useModule';
import type { ModuleProps } from '@/lib/registry';
import type { TMeta } from '@/types/app';
import type { InventoryItemProps } from '@/types/inventory/item';
import { useState } from 'react';

const DEFAULT_META: TMeta = { total: 0, page: 1, limit: 10, totalPages: 0 };

export default function InventoryItemsModule({
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

    const [tableData, setTableData] = useState<InventoryItemProps[]>(
        (initialData as InventoryItemProps[]) ?? [],
    );
    const [tableMeta, setTableMeta] = useState<TMeta>(initialMeta ?? DEFAULT_META);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

    const apiBase = `/api${currentPath.path}`;

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
            setToast({ msg: 'Item deleted successfully', type: 'success' });
            await fetchPage(tableMeta.page, tableMeta.limit);
        } catch {
            setToast({ msg: 'Failed to delete item', type: 'error' });
        } finally {
            setIsDeleting(false);
            setDeletingId(null);
        }
    };

    return (
        <>
            {toast && (
                <div
                    className={`fixed right-4 top-4 z-50 rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${
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

            <StockForm
                items={tableData}
                meta={tableMeta}
                onFetchPageAction={fetchPage}
                onDeleteAction={setDeletingId}
            />
        </>
    );
}
