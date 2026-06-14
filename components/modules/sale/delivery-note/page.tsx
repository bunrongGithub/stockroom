'use client';

import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { useRegisterModule } from '@/hook/useModule';
import type { ModuleProps } from '@/lib/registry';
import { getDeliveryNotes } from '@/lib/mock-sales-store';
import type { DeliveryNote, DeliveryNoteStatus } from '@/types/sales/order-management';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PlusIcon, EyeIcon } from 'lucide-react';

function DNStatusBadge({ status }: { status: DeliveryNoteStatus }) {
    const map: Record<DeliveryNoteStatus, string> = {
        draft: 'bg-gray-100 text-gray-700',
        confirmed: 'bg-emerald-100 text-emerald-700',
        cancelled: 'bg-rose-100 text-rose-700',
    };
    const labels: Record<DeliveryNoteStatus, string> = {
        draft: 'Draft',
        confirmed: 'Confirmed',
        cancelled: 'Cancelled',
    };
    return (
        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-mono font-medium ${map[status]}`}>
            {labels[status]}
        </span>
    );
}

export default function SaleDeliveryNotePage({ currentPath, permission, currentPathActions }: ModuleProps) {
    useRegisterModule({ actionModules: currentPathActions, permission, modulePath: currentPath.path });

    const router = useRouter();
    const [notes, setNotes] = useState<DeliveryNote[]>([]);

    useEffect(() => {
        setNotes(getDeliveryNotes());
    }, []);

    const columns: DataTableColumn<DeliveryNote>[] = [
        {
            key: 'delivery_no',
            header: 'Delivery No',
            cell: (row) => (
                <button
                    onClick={() => router.push(`/sale/delivery-note/${row.id}/view`)}
                    className="font-mono text-xs font-semibold text-sky-600 hover:underline"
                >
                    {row.delivery_no}
                </button>
            ),
        },
        {
            key: 'sales_order_no',
            header: 'Sales Order',
            cell: (row) => (
                <button
                    onClick={() => router.push(`/sale/order/${row.sales_order_id}/view`)}
                    className="font-mono text-xs text-sky-500 hover:underline"
                >
                    {row.sales_order_no}
                </button>
            ),
        },
        {
            key: 'customer',
            header: 'Customer',
            cell: (row) => <span className="font-mono text-xs">{row.customer_name}</span>,
        },
        {
            key: 'delivery_date',
            header: 'Delivery Date',
            cell: (row) => <span className="font-mono text-xs">{row.delivery_date}</span>,
        },
        {
            key: 'warehouse',
            header: 'Warehouse',
            cell: (row) => <span className="font-mono text-xs">{row.warehouse}</span>,
        },
        {
            key: 'status',
            header: 'Status',
            cell: (row) => <DNStatusBadge status={row.status} />,
        },
        {
            key: 'actions',
            header: 'Actions',
            cell: (row) => (
                <div className="flex items-center gap-1.5">
                    <button
                        onClick={() => router.push(`/sale/delivery-note/${row.id}/view`)}
                        className="inline-flex items-center gap-1 rounded-lg border border-sky-200 px-2 py-1 text-xs text-sky-600 hover:bg-sky-50 font-mono"
                    >
                        <EyeIcon size={11} /> View
                    </button>
                    {row.status === 'draft' && (
                        <button
                            onClick={() => router.push(`/sale/delivery-note/${row.id}/update`)}
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 px-2 py-1 text-xs text-emerald-600 hover:bg-emerald-50 font-mono"
                        >
                            Confirm
                        </button>
                    )}
                </div>
            ),
        },
    ];

    return (
        <main className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Delivery Notes</h1>
                    <p className="text-xs text-muted-foreground mt-0.5">Track shipments and deliveries</p>
                </div>
                <button
                    onClick={() => router.push('/sale/delivery-note/create')}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-500 font-mono shadow-sm"
                >
                    <PlusIcon size={15} /> New Delivery
                </button>
            </div>

            <DataTable<DeliveryNote>
                columns={columns}
                data={notes}
                keyExtractor={(row) => row.id}
                searchFn={(row, q) =>
                    row.delivery_no.toLowerCase().includes(q) ||
                    row.sales_order_no.toLowerCase().includes(q) ||
                    row.customer_name.toLowerCase().includes(q) ||
                    row.status.toLowerCase().includes(q)
                }
                searchPlaceholder="Search by delivery no, order, customer, or status..."
                pageSize={10}
                emptyTitle="No delivery notes"
                emptyDescription="Create a delivery note from a sales order to get started"
            />
        </main>
    );
}
