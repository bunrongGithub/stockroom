'use client';

import {
    ButtonActionDynamicRender,
    ButtonActionStaticRender,
} from '@/components/ui/button-action';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import PopUpDeleteTransactionModal from '@/components/ui/PopUpDeleteModal';
import { usePageActions } from '@/hook/usePageAction';
import { useRegisterModule } from '@/hook/useModule';
import { useTableQuery } from '@/hook/useTableQuery';
import type { ModuleProps } from '@/lib/registry';
import type { InventoryUom } from '@/service/apps/inventory/repo/uom';
import { Ruler, Star } from 'lucide-react';
import { useState } from 'react';

export default function InventoryUomListModule({
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

    const pageAction = usePageActions();
    const staticActions = pageAction?.actions.filter((a) => !a.dynamic) ?? [];
    const dynamicActions = pageAction?.actions.filter((a) => a.dynamic) ?? [];

    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [toast, setToast] = useState<{
        msg: string;
        type: 'success' | 'error';
    } | null>(null);

    const apiBase = `/api${currentPath.path}`;

    // Query Framework: search/sort/filter/pagination run server-side and the
    // full list state lives in the URL.
    const table = useTableQuery<InventoryUom>({
        endpoint: apiBase,
        initialData: initialData as InventoryUom[] | undefined,
        initialMeta,
        defaultSort: [{ field: 'name', direction: 'asc' }],
    });

    const onConfirmDelete = async () => {
        if (!deletingId) return;
        try {
            setIsDeleting(true);
            const res = await fetch(`${apiBase}/${deletingId}`, {
                method: 'DELETE',
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json.error ?? 'Delete failed');
            setToast({ msg: 'Unit deleted successfully', type: 'success' });
            await table.refresh();
        } catch (e) {
            setToast({
                msg: e instanceof Error ? e.message : 'Failed to delete unit',
                type: 'error',
            });
        } finally {
            setIsDeleting(false);
            setDeletingId(null);
            setTimeout(() => setToast(null), 4000);
        }
    };

    const columns: DataTableColumn<InventoryUom>[] = [
        {
            key: 'code',
            header: 'Code',
            sortable: true,
            cell: (row) => (
                <span className="inline-flex items-center gap-1.5">
                    <span className="rounded bg-gray-100 px-2.5 py-1 font-mono text-xs text-gray-600">
                        {row.code}
                    </span>
                    {row.is_default && (
                        <Star
                            size={12}
                            className="fill-amber-400 text-amber-400"
                            aria-label="Default unit"
                        />
                    )}
                </span>
            ),
        },
        {
            key: 'name',
            header: 'Name',
            sortable: true,
            cell: (row) => (
                <div className="min-w-0">
                    <div className="truncate font-mono text-xs text-gray-900">
                        {row.name}
                    </div>
                    {row.description && (
                        <div className="mt-0.5 truncate text-xs text-gray-500">
                            {row.description}
                        </div>
                    )}
                </div>
            ),
        },
        {
            key: 'display_name',
            header: 'Symbol',
            sortable: true,
            cell: (row) => (
                <span className="font-mono text-xs text-gray-700">
                    {row.display_name}
                </span>
            ),
        },
        {
            key: 'status',
            header: 'Status',
            cell: (row) => (
                <span
                    className={`inline-flex items-center rounded-md px-2 py-1 font-mono text-[10px] ${
                        row.is_active
                            ? 'bg-emerald-50 text-emerald-600'
                            : 'bg-slate-100 text-slate-500'
                    }`}
                >
                    {row.is_active ? 'Active' : 'Inactive'}
                </span>
            ),
        },
        {
            key: 'usage',
            header: 'Usage',
            sortable: true,
            sortKey: 'item_count',
            headerClassName: 'text-right',
            cellClassName: 'text-right',
            cell: (row) => (
                <span className="font-mono text-xs text-gray-700">
                    {row.item_count ?? 0} item
                    {(row.item_count ?? 0) === 1 ? '' : 's'}
                </span>
            ),
        },
        ...(dynamicActions.length > 0
            ? [
                  {
                      key: 'actions',
                      header: 'Actions',
                      headerClassName: 'text-right',
                      cellClassName: 'text-right',
                      cell: (row: InventoryUom) =>
                          ButtonActionDynamicRender(dynamicActions, row, () =>
                              setDeletingId(row.id),
                          ),
                  } satisfies DataTableColumn<InventoryUom>,
              ]
            : []),
    ];

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

            <div className="w-full min-w-0 space-y-5 font-mono">
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
                    <div>
                        <h2 className="flex items-center gap-2 text-2xl text-slate-800">
                            <Ruler className="text-[#1a9e52]" />
                            Unit of Measure
                        </h2>
                        <p className="mt-1 text-slate-500">
                            Manage the units used across inventory and transactions
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {staticActions.map((action) => (
                            <span key={action.key}>
                                {ButtonActionStaticRender(action, false)}
                            </span>
                        ))}
                    </div>
                </div>

                <DataTable<InventoryUom>
                    columns={columns}
                    data={table.data}
                    keyExtractor={(row) => row.id}
                    searchPlaceholder="Search by code, name, or description..."
                    pageSizeOptions={[10, 20, 50]}
                    serverQuery={table.binding}
                    filterDefs={[
                        { key: 'is_active', label: 'Status', type: 'boolean' },
                        { key: 'is_default', label: 'Default', type: 'boolean' },
                        {
                            key: 'created_at',
                            label: 'Created',
                            type: 'date-range',
                        },
                    ]}
                    enableColumnVisibility
                    emptyIcon={<Ruler size={32} />}
                    emptyTitle="No units of measure found"
                    emptyDescription="Create a unit like Piece (PCS) or Kilogram (KG) to get started"
                />
            </div>
        </>
    );
}
