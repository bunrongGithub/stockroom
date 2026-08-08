'use client';

import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { RowAction, RowActions } from '@/components/ui/button-action';
import { auditUserColumns } from '@/components/ui/audit-columns';
import { useRegisterModule } from '@/hook/useModule';
import { useTableQuery } from '@/hook/useTableQuery';
import type { ModuleProps } from '@/lib/registry';
import { saleShipmentApi } from '@/lib/api/sale';
import { API } from '@/lib/constant';
import type { SalesShipment, SalesShipmentStatus } from '@/types/sales/order-management';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    EyeIcon,
    PencilIcon,
    SendIcon,
    Ban,
    Trash2Icon,
} from 'lucide-react';

function StatusBadge({ status }: { status: SalesShipmentStatus }) {
    const map: Record<SalesShipmentStatus, string> = {
        DRAFT: 'bg-gray-100 text-gray-600',
        POSTED: 'bg-emerald-100 text-emerald-800',
        VOID: 'bg-rose-100 text-rose-800',
        INVOICED: 'bg-sky-100 text-sky-800',
        PARTIALLY_INVOICED: 'bg-amber-100 text-amber-800',
    };
    return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-mono font-medium ${map[status]}`}>{status}</span>;
}

export default function SaleShipmentPage({ currentPath, permission, currentPathActions, initialData, initialMeta }: ModuleProps) {
    useRegisterModule({ actionModules: currentPathActions, permission, modulePath: currentPath.path });

    const router = useRouter();
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
    const [confirm, setConfirm] = useState<{ type: 'post' | 'void' | 'delete'; id: number; no: string } | null>(null);
    const [busy, setBusy] = useState(false);

    function showToast(msg: string, type: 'success' | 'error') {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 4000);
    }

    // Query Framework: search/sort/filter/pagination run server-side and the
    // full list state lives in the URL.
    const table = useTableQuery<SalesShipment>({
        endpoint: API.sale.shipment.root,
        initialData: initialData as SalesShipment[] | undefined,
        initialMeta,
    });

    async function refreshShipments() {
        await table.refresh();
    }

    async function runAction() {
        if (!confirm) return;
        setBusy(true);
        try {
            if (confirm.type === 'post') await saleShipmentApi.post(confirm.id);
            else if (confirm.type === 'void') await saleShipmentApi.void(confirm.id);
            else await saleShipmentApi.remove(confirm.id);
            showToast(
                confirm.type === 'post' ? 'Shipment posted — stock updated.' : confirm.type === 'void' ? 'Shipment voided.' : 'Shipment deleted.',
                'success',
            );
            await refreshShipments();
        } catch (e) {
            showToast(e instanceof Error ? e.message : `Cannot ${confirm.type} shipment`, 'error');
        } finally {
            setBusy(false);
            setConfirm(null);
        }
    }

    const columns: DataTableColumn<SalesShipment>[] = [
        {
            key: 'shipment_no',
            header: 'Shipment No',
            sortable: true,
            cell: (row) => (
                <button onClick={() => router.push(`/sale/delivery-note/${row.id}/view`)} className="font-mono text-xs font-semibold text-sky-600 hover:underline">
                    {row.shipment_no}
                </button>
            ),
        },
        { key: 'order_no', header: 'Order', cell: (row) => <span className="font-mono text-xs">{row.sales_order_no}</span> },
        { key: 'customer', header: 'Customer', sortable: true, sortKey: 'customer_name', cell: (row) => <span className="font-mono text-xs">{row.customer_name || '—'}</span> },
        { key: 'delivery_date', header: 'Delivery Date', sortable: true, cell: (row) => <span className="font-mono text-xs">{row.delivery_date}</span> },
        { key: 'status', header: 'Status', sortable: true, cell: (row) => <StatusBadge status={row.status} /> },
        ...auditUserColumns<SalesShipment>(),
        {
            key: 'actions',
            header: 'Actions',
            sticky: 'right',
            align: 'right',
            cell: (row) => {
                const a = row.actions;
                return (
                    <RowActions>
                        <RowAction
                            label="View"
                            icon={<EyeIcon size={13} />}
                            href={`/sale/delivery-note/${row.id}/view`}
                        />
                        {a?.can_update && (
                            <RowAction
                                label="Edit"
                                icon={<PencilIcon size={13} />}
                                href={`/sale/delivery-note/${row.id}/update`}
                            />
                        )}
                        {a?.can_post && (
                            <RowAction
                                label="Post"
                                icon={<SendIcon size={13} />}
                                tone="primary"
                                onClick={() => setConfirm({ type: 'post', id: row.id, no: row.shipment_no })}
                            />
                        )}
                        {a?.can_void && (
                            <RowAction
                                label="Void"
                                icon={<Ban size={13} />}
                                tone="danger"
                                onClick={() => setConfirm({ type: 'void', id: row.id, no: row.shipment_no })}
                            />
                        )}
                        {a?.can_update && (
                            <RowAction
                                label="Delete"
                                icon={<Trash2Icon size={13} />}
                                tone="danger"
                                onClick={() => setConfirm({ type: 'delete', id: row.id, no: row.shipment_no })}
                            />
                        )}
                    </RowActions>
                );
            },
        },
    ];

    return (
        <main className="space-y-4">
            {toast && <div className={`fixed right-4 top-4 z-50 rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>{toast.msg}</div>}

            {confirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
                    <div className="rounded-2xl bg-white p-6 shadow-xl w-80 space-y-4">
                        <h3 className="font-semibold text-sm capitalize">{confirm.type} Shipment</h3>
                        <p className="text-xs text-muted-foreground">
                            {confirm.type === 'post'
                                ? `Post ${confirm.no}? This deducts stock and cannot be undone (create a return to reverse).`
                                : confirm.type === 'void'
                                  ? `Void ${confirm.no}? Only draft shipments can be voided.`
                                  : `Delete ${confirm.no}? This permanently removes the draft shipment.`}
                        </p>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setConfirm(null)} className="rounded-lg border px-3 py-1.5 text-xs hover:bg-muted font-mono">Cancel</button>
                            <button disabled={busy} onClick={runAction} className={`rounded-lg px-3 py-1.5 text-xs text-white font-mono disabled:opacity-60 ${confirm.type === 'post' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-500 hover:bg-rose-600'}`}>
                                {busy ? 'Working…' : 'Confirm'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Delivery Note</h1>
                    <p className="text-xs text-muted-foreground mt-0.5">Delivery notes and stock issue on posting</p>
                </div>
            </div>

            <DataTable<SalesShipment>
                columns={columns}
                data={table.data}
                keyExtractor={(row) => row.id}
                mobileVariant="cards"
                minTableWidth="1440px"
                searchPlaceholder="Search by shipment no, reference, or customer..."
                pageSizeOptions={[10, 20, 50]}
                serverQuery={table.binding}
                filterDefs={[
                    {
                        key: 'status',
                        label: 'Status',
                        type: 'select',
                        options: [
                            { value: 'DRAFT', label: 'Draft' },
                            { value: 'POSTED', label: 'Posted' },
                            { value: 'VOID', label: 'Void' },
                            { value: 'INVOICED', label: 'Invoiced' },
                            { value: 'PARTIALLY_INVOICED', label: 'Partially Invoiced' },
                        ],
                    },
                    { key: 'delivery_date', label: 'Delivery Date', type: 'date-range' },
                ]}
                enableColumnVisibility
                emptyTitle="No shipments"
                emptyDescription="Create a shipment from a sales order"
            />
        </main>
    );
}
