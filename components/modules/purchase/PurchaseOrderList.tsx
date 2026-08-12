'use client';

import { useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import {
    EyeIcon,
    PencilIcon,
    PlusIcon,
    TruckIcon,
    XCircleIcon,
} from 'lucide-react';

import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { RowAction, RowActions } from '@/components/ui/button-action';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/Toast';
import { PrototypeNotice } from './PrototypeNotice';
import {
    PO_STATUS_LABEL,
    fmt,
    outstandingOf,
    poTotals,
    purchaseStore,
    supplierOf,
    type PurchaseOrder,
} from './mock/data';

/**
 * Purchase Orders list — the Sale Orders list's twin.
 *
 * Same composition: PageHeader with the create action, a DataTable with
 * per-row RowActions, and a ConfirmDialog for the state changes. Statuses use
 * the shared StatusBadge so Purchase and Sale read identically at a glance.
 */
export default function PurchaseOrderList() {
    const router = useRouter();
    const toast = useToast();
    const orders = useSyncExternalStore(
        purchaseStore.subscribe,
        purchaseStore.listPos,
        purchaseStore.listPos,
    );
    const [cancelTarget, setCancelTarget] = useState<{
        id: number;
        no: string;
    } | null>(null);

    const columns: DataTableColumn<PurchaseOrder>[] = [
        {
            key: 'po_no',
            header: 'PO No',
            primary: true,
            cell: (row) => (
                <button
                    onClick={() => router.push(`/purchase/order/${row.id}/view`)}
                    className="font-medium text-primary hover:underline"
                >
                    {row.po_no}
                </button>
            ),
        },
        {
            key: 'supplier',
            header: 'Supplier',
            cell: (row) => supplierOf(row.supplier_id)?.name ?? '—',
        },
        {
            key: 'order_date',
            header: 'Order Date',
            cell: (row) => <span className="tabular-nums">{row.order_date}</span>,
        },
        {
            key: 'expected_date',
            header: 'Expected Date',
            cell: (row) => (
                <span className="tabular-nums">{row.expected_date ?? '—'}</span>
            ),
        },
        {
            key: 'outstanding',
            header: 'Outstanding',
            align: 'right',
            cell: (row) => {
                const left = row.lines.reduce((s, l) => s + outstandingOf(l), 0);
                return (
                    <span
                        className={`tabular-nums ${
                            left > 0 ? 'font-medium text-amber-600' : 'text-muted-foreground'
                        }`}
                    >
                        {left}
                    </span>
                );
            },
        },
        {
            key: 'grand_total',
            header: 'Grand Total',
            align: 'right',
            cell: (row) => (
                <span className="font-medium tabular-nums">
                    {row.currency} {fmt(poTotals(row.lines).total)}
                </span>
            ),
        },
        {
            key: 'status',
            header: 'Status',
            cell: (row) => (
                <StatusBadge
                    status={row.status.toLowerCase()}
                    label={PO_STATUS_LABEL[row.status]}
                />
            ),
        },
        {
            key: 'actions',
            header: 'Actions',
            sticky: 'right',
            align: 'right',
            hideOnCard: false,
            cardFooter: true,
            cell: (row) => {
                const outstanding = row.lines.reduce(
                    (s, l) => s + outstandingOf(l),
                    0,
                );
                const canReceive =
                    outstanding > 0 &&
                    (row.status === 'OPEN' ||
                        row.status === 'PARTIALLY_RECEIVED');
                // Editable and cancellable only while untouched — once a
                // receipt is posted the order has to be settled, not rewritten.
                const untouched = row.status === 'OPEN';
                return (
                    <RowActions>
                        <RowAction
                            label="View"
                            icon={<EyeIcon size={13} />}
                            href={`/purchase/order/${row.id}/view`}
                        />
                        {untouched && (
                            <RowAction
                                label="Edit"
                                icon={<PencilIcon size={13} />}
                                href={`/purchase/order/${row.id}/update`}
                            />
                        )}
                        {canReceive && (
                            <RowAction
                                label="Receive"
                                icon={<TruckIcon size={13} />}
                                onClick={() =>
                                    router.push(`/purchase/grn/create?po=${row.id}`)
                                }
                            />
                        )}
                        {untouched && (
                            <RowAction
                                label="Cancel"
                                icon={<XCircleIcon size={13} />}
                                tone="danger"
                                onClick={() =>
                                    setCancelTarget({
                                        id: row.id,
                                        no: row.po_no,
                                    })
                                }
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
                title="Purchase Orders"
                description="Manage supplier orders and goods receipts"
                actions={
                    <Button onClick={() => router.push('/purchase/order/create')}>
                        <PlusIcon size={16} /> Create
                    </Button>
                }
            />

            <PrototypeNotice />

            <DataTable<PurchaseOrder>
                columns={columns}
                data={orders}
                keyExtractor={(row) => row.id}
                mobileVariant="cards"
                minTableWidth="1340px"
                searchPlaceholder="Search by PO no, reference, or supplier..."
                pageSizeOptions={[10, 20, 50]}
                searchFn={(row, q) =>
                    `${row.po_no} ${supplierOf(row.supplier_id)?.name ?? ''} ${row.supplier_ref ?? ''}`
                        .toLowerCase()
                        .includes(q.toLowerCase())
                }
                // No filterDefs: DataTable only renders the filter bar in
                // serverQuery mode. The real build swaps this client array for
                // useTableQuery, and the Status / date filters arrive with it —
                // exactly as the Sale Orders list does today.
                enableColumnVisibility
                emptyTitle="No purchase orders"
                emptyDescription="Create your first purchase order to get started"
            />

            <ConfirmDialog
                open={cancelTarget !== null}
                onOpenChange={(o) => !o && setCancelTarget(null)}
                title="Cancel Order"
                description={`Cancel ${cancelTarget?.no}? Orders with posted receipts cannot be cancelled.`}
                confirmLabel="Cancel Order"
                tone="danger"
                onConfirm={async () => {
                    if (!cancelTarget) return;
                    purchaseStore.setPoStatus(cancelTarget.id, 'CANCELLED');
                    toast.success(`${cancelTarget.no} cancelled.`);
                }}
            />
        </div>
    );
}
