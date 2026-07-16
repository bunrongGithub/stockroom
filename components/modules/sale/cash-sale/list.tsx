'use client';

import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { useRegisterModule } from '@/hook/useModule';
import { cashSaleApi, type CashSaleListRow } from '@/lib/api/cash-sale';
import type { ModuleProps } from '@/lib/registry';
import type { TMeta } from '@/types/app';
import { EyeIcon, PrinterIcon, ShoppingCart } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Cash Sale history — completed counter sales, browsable and reprintable. Each
 * row is a real sales order on the cash_sale channel joined to its invoice;
 * Reprint opens that invoice's print view.
 */

const DEFAULT_META: TMeta = { total: 0, page: 1, limit: 10, totalPages: 0 };

const PAYMENT_BADGE: Record<string, string> = {
    PAID: 'bg-emerald-100 text-emerald-800',
    PARTIALLY_PAID: 'bg-amber-100 text-amber-800',
    UNPAID: 'bg-rose-100 text-rose-800',
};

function money(n: number) {
    return n.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

export default function SaleCashSaleList({
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

    const router = useRouter();
    const [rows, setRows] = useState<CashSaleListRow[]>(
        (initialData as CashSaleListRow[]) ?? [],
    );
    const [meta, setMeta] = useState<TMeta>(initialMeta ?? DEFAULT_META);

    // Server-side pagination: one page in memory, so paging re-queries.
    async function fetchPage(page: number, limit: number) {
        const res = await cashSaleApi.listPage({ page, limit });
        setRows(res.data);
        setMeta(res.meta ?? DEFAULT_META);
    }

    const columns: DataTableColumn<CashSaleListRow>[] = [
        {
            key: 'order_no',
            header: 'Sale No',
            primary: true,
            cell: (row) => (
                <button
                    onClick={() => router.push(`/sale/order/${row.id}/view`)}
                    className="font-mono text-xs font-semibold text-[#1a9e52] hover:underline"
                >
                    {row.order_no}
                </button>
            ),
        },
        {
            key: 'order_date',
            header: 'Date',
            cell: (row) => (
                <span className="font-mono text-xs tabular-nums">
                    {row.order_date}
                </span>
            ),
        },
        {
            key: 'customer',
            header: 'Customer',
            cell: (row) => (
                <span className="font-mono text-xs">
                    {row.customer_name || 'Walk-in Customer'}
                </span>
            ),
        },
        {
            key: 'invoice_no',
            header: 'Invoice',
            cell: (row) => (
                <span className="font-mono text-xs">
                    {row.invoice_no ?? '—'}
                </span>
            ),
        },
        {
            key: 'grand_total',
            header: 'Total',
            align: 'right',
            cell: (row) => (
                <span className="font-mono text-xs font-semibold tabular-nums">
                    {row.currency} {money(row.grand_total)}
                </span>
            ),
        },
        {
            key: 'payment_status',
            header: 'Payment',
            cell: (row) =>
                row.payment_status ? (
                    <span
                        className={`inline-block rounded-full px-2 py-0.5 font-mono text-xs font-medium ${
                            PAYMENT_BADGE[row.payment_status] ??
                            'bg-gray-100 text-gray-600'
                        }`}
                    >
                        {row.payment_status.replace('_', ' ')}
                    </span>
                ) : (
                    <span className="text-slate-400">—</span>
                ),
        },
        {
            key: 'actions',
            header: 'Actions',
            align: 'right',
            cardFooter: true,
            cell: (row) => (
                <div className="flex flex-wrap items-center justify-end gap-1.5">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/sale/order/${row.id}/view`)}
                    >
                        <EyeIcon size={13} /> View
                    </Button>
                    {row.invoice_id && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                                window.open(
                                    `/finances/invoice/${row.invoice_id}/print`,
                                    '_blank',
                                )
                            }
                        >
                            <PrinterIcon size={13} /> Reprint
                        </Button>
                    )}
                </div>
            ),
        },
    ];

    return (
        <div className="space-y-4 font-mono">
            <PageHeader
                title="Cash Sale History"
                description="Completed counter sales — view or reprint a receipt."
                actions={
                    permission?.can_create && (
                        <Button onClick={() => router.push('/sale/cash-sale')}>
                            <ShoppingCart size={15} /> New Sale
                        </Button>
                    )
                }
            />

            <DataTable<CashSaleListRow>
                columns={columns}
                data={rows}
                keyExtractor={(row) => row.id}
                mobileVariant="cards"
                minTableWidth="760px"
                searchFn={(row, q) =>
                    row.order_no.toLowerCase().includes(q) ||
                    (row.invoice_no ?? '').toLowerCase().includes(q) ||
                    row.customer_name.toLowerCase().includes(q)
                }
                searchPlaceholder="Search by sale no, invoice, or customer..."
                pageSize={meta.limit}
                pageSizeOptions={[10, 20, 50]}
                serverSide={{
                    total: meta.total,
                    page: meta.page,
                    totalPages: meta.totalPages,
                    onPageChange: (p) => fetchPage(p, meta.limit),
                    onPageSizeChange: (limit) => fetchPage(1, limit),
                }}
                emptyTitle="No cash sales yet"
                emptyDescription="Completed counter sales will appear here"
            />
        </div>
    );
}
