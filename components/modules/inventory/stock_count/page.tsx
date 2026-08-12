'use client';

import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { auditUserColumns } from '@/components/ui/audit-columns';
import { PAGE_ACTION_CLASS, PageHeader } from '@/components/ui/PageHeader';
import { RowAction, RowActions } from '@/components/ui/button-action';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/Toast';
import { useRegisterModule } from '@/hook/useModule';
import { useTableQuery } from '@/hook/useTableQuery';
import type { ModuleProps } from '@/lib/registry';
import { stockCountApi } from '@/lib/api/stock-count';
import { API } from '@/lib/constant';
import { formatDate, formatDateTime } from '@/lib/utils/date';
import type { StockCount, StockCountStatus } from '@/types/inventory/stock-count';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PlusIcon, EyeIcon, PencilIcon, Trash2Icon } from 'lucide-react';

const STATUS_LABEL: Record<StockCountStatus, string> = {
    DRAFT: 'Draft',
    PREPARED: 'Prepared',
    COUNTING: 'Counting',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
};

export default function InventoryStockCountModule({
    currentPath,
    permission,
    currentPathActions,
    initialData,
    initialMeta,
}: ModuleProps) {
    useRegisterModule({ actionModules: currentPathActions, permission, modulePath: currentPath.path });

    const router = useRouter();
    const toast = useToast();
    const [confirmDelete, setConfirmDelete] = useState<{ id: number; no: string } | null>(null);

    const table = useTableQuery<StockCount>({
        endpoint: API.inventory.stockCount.root,
        initialData: initialData as StockCount[] | undefined,
        initialMeta,
    });

    async function handleDelete(id: number) {
        try {
            await stockCountApi.remove(id);
            toast.success('Stock count deleted.');
            await table.refresh();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Cannot delete stock count');
            throw e; // keep the confirm dialog open on failure
        }
    }

    const columns: DataTableColumn<StockCount>[] = [
        {
            key: 'count_no',
            header: 'Count No',
            primary: true,
            sortable: true,
            cell: (row) => (
                <button
                    onClick={() => router.push(`/inventory/stock_count/${row.id}/view`)}
                    className="font-medium text-primary hover:underline"
                >
                    {row.count_no}
                </button>
            ),
        },
        {
            key: 'count_date',
            header: 'Date',
            sortable: true,
            cell: (row) => <span className="tnums">{formatDate(row.count_date)}</span>,
        },
        { key: 'warehouse', header: 'Warehouse', sortable: true, sortKey: 'warehouse_name', cell: (row) => row.warehouse_name },
        {
            key: 'location',
            header: 'Location',
            cell: (row) => row.location_name ?? <span className="text-muted-foreground">All locations</span>,
        },
        {
            key: 'status',
            header: 'Status',
            cell: (row) => <StatusBadge status={row.status} label={STATUS_LABEL[row.status]} />,
        },
        {
            key: 'created_at',
            header: 'Created',
            sortable: true,
            cell: (row) => <span className="tnums">{formatDateTime(row.created_at)}</span>,
        },
        ...auditUserColumns<StockCount>(),
        {
            key: 'actions',
            header: 'Actions',
            sticky: 'right',
            align: 'right',
            hideOnCard: false,
            cardFooter: true,
            cell: (row) => {
                const a = row.actions;
                return (
                    <RowActions>
                        <RowAction
                            label="View"
                            icon={<EyeIcon size={13} />}
                            href={`/inventory/stock_count/${row.id}/view`}
                        />
                        {permission?.can_update && a?.can_update && (
                            <RowAction
                                label="Edit"
                                icon={<PencilIcon size={13} />}
                                href={`/inventory/stock_count/${row.id}/update`}
                            />
                        )}
                        {permission?.can_delete && a?.can_delete && (
                            <RowAction
                                label="Delete"
                                icon={<Trash2Icon size={13} />}
                                tone="danger"
                                onClick={() => setConfirmDelete({ id: row.id, no: row.count_no })}
                            />
                        )}
                    </RowActions>
                );
            },
        },
    ];

    return (
        <div className="space-y-4 font-mono">
            <PageHeader
                title="Physical Stock Counts"
                description="Count inventory against a frozen snapshot and correct variances"
                actions={
                    permission?.can_create && (
                        <Button
                            className={PAGE_ACTION_CLASS}
                            onClick={() => router.push('/inventory/stock_count/create')}
                        >
                            <PlusIcon size={16} /> New Count
                        </Button>
                    )
                }
            />

            <DataTable<StockCount>
                columns={columns}
                data={table.data}
                keyExtractor={(row) => row.id}
                mobileVariant="cards"
                minTableWidth="1700px"
                searchPlaceholder="Search by count no..."
                pageSizeOptions={[10, 20, 50]}
                serverQuery={table.binding}
                filterDefs={[
                    {
                        key: 'status',
                        label: 'Status',
                        type: 'select',
                        options: Object.entries(STATUS_LABEL).map(
                            ([value, label]) => ({ value, label }),
                        ),
                    },
                    {
                        key: 'count_date',
                        label: 'Count Date',
                        type: 'date-range',
                    },
                ]}
                enableColumnVisibility
                emptyTitle="No stock counts"
                emptyDescription="Create your first physical stock count to get started"
            />

            <ConfirmDialog
                open={confirmDelete !== null}
                onOpenChange={(o) => !o && setConfirmDelete(null)}
                title="Delete Stock Count"
                description={`Delete ${confirmDelete?.no}? This cannot be undone.`}
                confirmLabel="Delete"
                tone="danger"
                onConfirm={async () => {
                    if (confirmDelete) await handleDelete(confirmDelete.id);
                }}
            />
        </div>
    );
}
