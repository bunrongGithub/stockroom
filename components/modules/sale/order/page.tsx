'use client';

import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/Toast';
import { useRegisterModule } from '@/hook/useModule';
import type { ModuleProps } from '@/lib/registry';
import { saleOrderApi } from '@/lib/api/sale';
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

export default function SaleOrderPage({ currentPath, permission, currentPathActions, initialData }: ModuleProps) {
    useRegisterModule({ actionModules: currentPathActions, permission, modulePath: currentPath.path });

    const router = useRouter();
    const toast = useToast();
    const [orders, setOrders] = useState<SalesOrder[]>(
        (initialData as SalesOrder[]) ?? [],
    );
    const [confirmAction, setConfirmAction] = useState<{ type: 'cancel' | 'close'; id: number; no: string } | null>(null);

    async function refreshOrders() {
        try {
            setOrders(await saleOrderApi.list());
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Failed to load orders');
        }
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
            cell: (row) => (
                <button
                    onClick={() => router.push(`/sale/order/${row.id}/view`)}
                    className="font-medium text-primary hover:underline"
                >
                    {row.order_no}
                </button>
            ),
        },
        { key: 'customer', header: 'Customer', cell: (row) => row.customer_name },
        { key: 'order_date', header: 'Order Date', cell: (row) => <span className="tabular-nums">{row.order_date}</span> },
        { key: 'expected_delivery', header: 'Expected Delivery', cell: (row) => <span className="tabular-nums">{row.expected_delivery_date ?? '—'}</span> },
        {
            key: 'grand_total',
            header: 'Grand Total',
            align: 'right',
            cell: (row) => <span className="font-medium tabular-nums">{row.currency} {fmt(row.grand_total)}</span>,
        },
        {
            key: 'status',
            header: 'Status',
            cell: (row) => <StatusBadge status={row.status} label={STATUS_LABEL[row.status]} />,
        },
        {
            key: 'actions',
            header: 'Actions',
            align: 'right',
            hideOnCard: false,
            cardFooter: true,
            cell: (row) => {
                const a = row.actions;
                return (
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                        <Button variant="outline" size="sm" onClick={() => router.push(`/sale/order/${row.id}/view`)}>
                            <EyeIcon size={14} /> View
                        </Button>
                        {a?.can_update && (
                            <Button variant="outline" size="sm" onClick={() => router.push(`/sale/order/${row.id}/update`)}>
                                <PencilIcon size={14} /> Edit
                            </Button>
                        )}
                        {a?.can_ship && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    if (typeof window !== 'undefined') sessionStorage.setItem('pending_dn_order_id', String(row.id));
                                    router.push('/sale/delivery-note/create');
                                }}
                            >
                                <TruckIcon size={14} /> Ship
                            </Button>
                        )}
                        {a?.can_close && (
                            <Button variant="outline" size="sm" onClick={() => setConfirmAction({ type: 'close', id: row.id, no: row.order_no })}>
                                <CheckCircleIcon size={14} /> Close
                            </Button>
                        )}
                        {a?.can_cancel && (
                            <Button variant="outline" size="sm" className="text-danger hover:text-danger" onClick={() => setConfirmAction({ type: 'cancel', id: row.id, no: row.order_no })}>
                                <XCircleIcon size={14} /> Cancel
                            </Button>
                        )}
                    </div>
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
                data={orders}
                keyExtractor={(row) => row.id}
                mobileVariant="cards"
                minTableWidth="860px"
                searchFn={(row, q) =>
                    row.order_no.toLowerCase().includes(q) ||
                    row.customer_name.toLowerCase().includes(q) ||
                        row.status.toLowerCase().includes(q)
                    }
                    searchPlaceholder="Search by order no, customer, or status..."
                    pageSize={10}
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
