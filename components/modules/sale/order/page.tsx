'use client';

import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { auditUserColumns } from '@/components/ui/audit-columns';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { RowAction, RowActions } from '@/components/ui/button-action';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/Toast';
import { useRegisterModule } from '@/hook/useModule';
import { useTableQuery } from '@/hook/useTableQuery';
import type { ModuleProps } from '@/lib/registry';
import { saleOrderApi } from '@/lib/api/sale';
import { API } from '@/lib/constant';
import type { SalesOrder, SalesOrderStatus } from '@/types/sales/order-management';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    PlusIcon,
    EyeIcon,
    PencilIcon,
    TruckIcon,
    XCircleIcon,
    CheckCircleIcon,
} from 'lucide-react';

const STATUS_LABEL: Record<SalesOrderStatus, string> = {
    open: 'Open',
    partial_shipment: 'Partial Shipment',
    closed: 'Closed',
    cancelled: 'Cancelled',
};

function fmt(n: number) {
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function SaleOrderPage({ currentPath, permission, currentPathActions, initialData, initialMeta }: ModuleProps) {
    useRegisterModule({ actionModules: currentPathActions, permission, modulePath: currentPath.path });

    const router = useRouter();
    const toast = useToast();
    const [confirmAction, setConfirmAction] = useState<{ type: 'cancel' | 'close'; id: number; no: string } | null>(null);

    // Query Framework: search/sort/filter/pagination run server-side and the
    // full list state lives in the URL.
    const table = useTableQuery<SalesOrder>({
        endpoint: API.sale.order.root,
        initialData: initialData as SalesOrder[] | undefined,
        initialMeta,
    });

    /** Re-read the current page so totals and statuses stay truthful. */
    async function refreshOrders() {
        await table.refresh();
    }

    async function runAction(type: 'cancel' | 'close', id: number) {
        try {
            if (type === 'cancel') await saleOrderApi.cancel(id);
            else await saleOrderApi.close(id);
            toast.success(`Sales order ${type === 'cancel' ? 'cancelled' : 'closed'}.`);
            await refreshOrders();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : `Cannot ${type} order`);
            throw e; // keep the confirm dialog open on failure
        }
    }

    const columns: DataTableColumn<SalesOrder>[] = [
        {
            key: 'order_no',
            header: 'Order No',
            primary: true,
            sortable: true,
            cell: (row) => (
                <button
                    onClick={() => router.push(`/sale/order/${row.id}/view`)}
                    className="font-medium text-primary hover:underline"
                >
                    {row.order_no}
                </button>
            ),
        },
        { key: 'customer', header: 'Customer', sortable: true, sortKey: 'customer_name', cell: (row) => row.customer_name },
        { key: 'order_date', header: 'Order Date', sortable: true, cell: (row) => <span className="tabular-nums">{row.order_date}</span> },
        { key: 'expected_delivery', header: 'Expected Delivery', cell: (row) => <span className="tabular-nums">{row.expected_delivery_date ?? '—'}</span> },
        {
            key: 'grand_total',
            header: 'Grand Total',
            align: 'right',
            sortable: true,
            cell: (row) => <span className="font-medium tabular-nums">{row.currency} {fmt(row.grand_total)}</span>,
        },
        {
            key: 'status',
            header: 'Status',
            cell: (row) => <StatusBadge status={row.status} label={STATUS_LABEL[row.status]} />,
        },
        ...auditUserColumns<SalesOrder>(),
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
                            href={`/sale/order/${row.id}/view`}
                        />
                        {a?.can_update && (
                            <RowAction
                                label="Edit"
                                icon={<PencilIcon size={13} />}
                                href={`/sale/order/${row.id}/update`}
                            />
                        )}
                        {a?.can_ship && (
                            <RowAction
                                label="Ship"
                                icon={<TruckIcon size={13} />}
                                onClick={() => {
                                    if (typeof window !== 'undefined') sessionStorage.setItem('pending_dn_order_id', String(row.id));
                                    router.push('/sale/delivery-note/create');
                                }}
                            />
                        )}
                        {a?.can_close && (
                            <RowAction
                                label="Close"
                                icon={<CheckCircleIcon size={13} />}
                                onClick={() => setConfirmAction({ type: 'close', id: row.id, no: row.order_no })}
                            />
                        )}
                        {a?.can_cancel && (
                            <RowAction
                                label="Cancel"
                                icon={<XCircleIcon size={13} />}
                                tone="danger"
                                onClick={() => setConfirmAction({ type: 'cancel', id: row.id, no: row.order_no })}
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
                title="Orders"
                description="Manage customer orders and shipments"
                actions={
                    permission?.can_create && (
                        <Button onClick={() => router.push('/sale/order/create')}>
                            <PlusIcon size={16} /> Create
                        </Button>
                    )
                }
            />

            <DataTable<SalesOrder>
                columns={columns}
                data={table.data}
                keyExtractor={(row) => row.id}
                mobileVariant="cards"
                minTableWidth="1640px"
                searchPlaceholder="Search by order no, reference, or customer..."
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
                        key: 'order_date',
                        label: 'Order Date',
                        type: 'date-range',
                    },
                ]}
                enableColumnVisibility
                emptyTitle="No sales orders"
                emptyDescription="Create your first sales order to get started"
            />

            <ConfirmDialog
                open={confirmAction !== null}
                onOpenChange={(o) => !o && setConfirmAction(null)}
                title={confirmAction?.type === 'cancel' ? 'Cancel Order' : 'Close Order'}
                description={
                    confirmAction?.type === 'cancel'
                        ? `Cancel ${confirmAction?.no}? Orders with posted shipments cannot be cancelled.`
                        : `Mark ${confirmAction?.no} as closed? No further shipments will be allowed.`
                }
                confirmLabel={confirmAction?.type === 'cancel' ? 'Cancel Order' : 'Close Order'}
                tone={confirmAction?.type === 'cancel' ? 'danger' : 'default'}
                onConfirm={async () => {
                    if (confirmAction) await runAction(confirmAction.type, confirmAction.id);
                }}
            />
        </div>
    );
}
