'use client';

import { useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { EyeIcon, PlusIcon, ShoppingCart } from 'lucide-react';

import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { RowAction, RowActions } from '@/components/ui/button-action';
import { Button } from '@/components/ui/button';
import { PrototypeNotice } from './PrototypeNotice';
import {
    GRN_STATUS_LABEL,
    fmt,
    purchaseStore,
    supplierOf,
    type Grn,
} from './mock/data';

/**
 * Goods Receipts list — the Delivery Notes list's twin.
 *
 * A receipt is to a purchase order what a shipment is to a sales order, so the
 * list carries the same columns in the same order: document number, the order
 * it belongs to, the counterparty, date, quantity and status.
 */
export default function GrnList() {
    const router = useRouter();
    const receipts = useSyncExternalStore(
        purchaseStore.subscribe,
        purchaseStore.listGrns,
        purchaseStore.listGrns,
    );

    const columns: DataTableColumn<Grn>[] = [
        {
            key: 'grn_no',
            header: 'GRN No',
            primary: true,
            cell: (row) => (
                <button
                    onClick={() => router.push(`/purchase/grn/${row.id}/view`)}
                    className="font-medium text-primary hover:underline"
                >
                    {row.grn_no}
                </button>
            ),
        },
        {
            key: 'po_no',
            header: 'Purchase Order',
            cell: (row) => {
                const po = purchaseStore.getPo(row.po_id);
                return po ? (
                    <button
                        onClick={() => router.push(`/purchase/order/${po.id}/view`)}
                        className="text-muted-foreground hover:text-primary hover:underline"
                    >
                        {po.po_no}
                    </button>
                ) : (
                    '—'
                );
            },
        },
        {
            key: 'supplier',
            header: 'Supplier',
            cell: (row) => supplierOf(row.supplier_id)?.name ?? '—',
        },
        {
            key: 'supplier_dn_no',
            header: 'Supplier DN',
            cell: (row) => row.supplier_dn_no ?? '—',
        },
        {
            key: 'receipt_date',
            header: 'Receipt Date',
            cell: (row) => <span className="tabular-nums">{row.receipt_date}</span>,
        },
        {
            key: 'units',
            header: 'Units',
            align: 'right',
            cell: (row) => (
                <span className="tabular-nums">
                    {row.lines.reduce((s, l) => s + l.received_qty, 0)}
                </span>
            ),
        },
        {
            key: 'value',
            header: 'Value',
            align: 'right',
            cell: (row) => (
                <span className="font-medium tabular-nums">
                    {fmt(
                        row.lines.reduce(
                            (s, l) => s + l.received_qty * l.unit_cost,
                            0,
                        ),
                    )}
                </span>
            ),
        },
        {
            key: 'status',
            header: 'Status',
            cell: (row) => (
                <StatusBadge
                    status={row.status.toLowerCase()}
                    label={GRN_STATUS_LABEL[row.status]}
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
            cell: (row) => (
                <RowActions>
                    <RowAction
                        label="View"
                        icon={<EyeIcon size={13} />}
                        href={`/purchase/grn/${row.id}/view`}
                    />
                    <RowAction
                        label="Order"
                        icon={<ShoppingCart size={13} />}
                        href={`/purchase/order/${row.po_id}/view`}
                    />
                </RowActions>
            ),
        },
    ];

    return (
        <div className="space-y-4 font-mono">
            <PageHeader
                title="Goods Receipts"
                description="Record what physically arrived from suppliers"
                actions={
                    <Button onClick={() => router.push('/purchase/grn/create')}>
                        <PlusIcon size={16} /> Create
                    </Button>
                }
            />

            <PrototypeNotice />

            <DataTable<Grn>
                columns={columns}
                data={receipts}
                keyExtractor={(row) => row.id}
                mobileVariant="cards"
                minTableWidth="1100px"
                searchPlaceholder="Search by GRN no, PO no, or supplier..."
                pageSizeOptions={[10, 20, 50]}
                searchFn={(row, q) => {
                    const po = purchaseStore.getPo(row.po_id);
                    return `${row.grn_no} ${po?.po_no ?? ''} ${supplierOf(row.supplier_id)?.name ?? ''} ${row.supplier_dn_no ?? ''}`
                        .toLowerCase()
                        .includes(q.toLowerCase());
                }}
                // No filterDefs: DataTable only renders the filter bar in
                // serverQuery mode. The real build swaps this client array for
                // useTableQuery, and the Status / date filters arrive with it —
                // exactly as the Sale Orders list does today.
                enableColumnVisibility
                emptyTitle="No goods receipts"
                emptyDescription="Receipts are raised against an open purchase order"
            />
        </div>
    );
}
