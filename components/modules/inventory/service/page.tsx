'use client';

import ServiceItemListForm from '@/components/forms/inventory/service/ServiceItemListForm';
import PopUpDeleteTransactionModal from '@/components/ui/PopUpDeleteModal';
import { useRegisterModule } from '@/hook/useModule';
import { useTableQuery } from '@/hook/useTableQuery';
import type { ModuleProps } from '@/lib/registry';
import type { InventoryItemProps } from '@/types/inventory/item';
import { useState } from 'react';

export default function InventoryServiceItemModule({
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

    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

    const apiBase = `/api${currentPath.path}`;

    // Query Framework: search/sort/filter/pagination run server-side and the
    // full list state lives in the URL.
    const table = useTableQuery<InventoryItemProps>({
        endpoint: apiBase,
        initialData: initialData as InventoryItemProps[] | undefined,
        initialMeta,
    });

    const onConfirmDelete = async () => {
        if (!deletingId) return;
        try {
            setIsDeleting(true);
            const res = await fetch(`${apiBase}/${deletingId}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Delete failed');
            setToast({ msg: 'Item deleted successfully', type: 'success' });
            await table.refresh();
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

            <ServiceItemListForm
                items={table.data}
                serverQuery={table.binding}
                onDeleteAction={setDeletingId}
            />
        </>
    );
}
