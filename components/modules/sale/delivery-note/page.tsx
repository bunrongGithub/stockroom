'use client';

import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { useRegisterModule } from '@/hook/useModule';
import type { ModuleProps } from '@/lib/registry';
import { saleShipmentApi } from '@/lib/api/sale';
import type { SalesShipment, SalesShipmentStatus } from '@/types/sales/order-management';
import type { TMeta } from '@/types/app';
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

const DEFAULT_META: TMeta = { total: 0, page: 1, limit: 10, totalPages: 0 };

export default function SaleShipmentPage({ currentPath, permission, currentPathActions, initialData, initialMeta }: ModuleProps) {
    useRegisterModule({ actionModules: currentPathActions, permission, modulePath: currentPath.path });

    const router = useRouter();
    const [shipments, setShipments] = useState<SalesShipment[]>(
        (initialData as SalesShipment[]) ?? [],
    );
    const [meta, setMeta] = useState<TMeta>(initialMeta ?? DEFAULT_META);
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
    const [confirm, setConfirm] = useState<{ type: 'post' | 'void' | 'delete'; id: number; no: string } | null>(null);
    const [busy, setBusy] = useState(false);

    function showToast(msg: string, type: 'success' | 'error') {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 4000);
    }

    // Server-side pagination: one page in memory, so paging re-queries.
    async function fetchPage(page: number, limit: number) {
        try {
            const res = await saleShipmentApi.listPage({ page, limit });
            setShipments(res.data);
            setMeta(res.meta ?? DEFAULT_META);
        } catch (e) {
            showToast(e instanceof Error ? e.message : 'Failed to load shipments', 'error');
        }
    }

    async function refreshShipments() {
        await fetchPage(meta.page, meta.limit);
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
            cell: (row) => (
                <button onClick={() => router.push(`/sale/delivery-note/${row.id}/view`)} className="font-mono text-xs font-semibold text-sky-600 hover:underline">
                    {row.shipment_no}
                </button>
            ),
        },
        { key: 'order_no', header: 'Order', cell: (row) => <span className="font-mono text-xs">{row.sales_order_no}</span> },
        { key: 'customer', header: 'Customer', cell: (row) => <span className="font-mono text-xs">{row.customer_name || '—'}</span> },
        { key: 'delivery_date', header: 'Delivery Date', cell: (row) => <span className="font-mono text-xs">{row.delivery_date}</span> },
        { key: 'status', header: 'Status', cell: (row) => <StatusBadge status={row.status} /> },
        {
            key: 'actions',
            header: 'Actions',
            cell: (row) => {
                const a = row.actions;
                return (
                    <div className="flex items-center gap-1.5">
                        <button onClick={() => router.push(`/sale/delivery-note/${row.id}/view`)} className="inline-flex items-center gap-1 rounded-lg border border-sky-200 px-2 py-1 text-xs text-sky-600 hover:bg-sky-50 font-mono">
                            <EyeIcon size={11} /> View
                        </button>
                        {a?.can_update && (
                            <button onClick={() => router.push(`/sale/delivery-note/${row.id}/update`)} className="inline-flex items-center gap-1 rounded-lg border border-violet-200 px-2 py-1 text-xs text-violet-600 hover:bg-violet-50 font-mono">
                                <PencilIcon size={11} /> Edit
                            </button>
                        )}
                        {a?.can_post && (
                            <button onClick={() => setConfirm({ type: 'post', id: row.id, no: row.shipment_no })} className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 px-2 py-1 text-xs text-emerald-600 hover:bg-emerald-50 font-mono">
                                <SendIcon size={11} /> Post
                            </button>
                        )}
                        {a?.can_void && (
                            <button onClick={() => setConfirm({ type: 'void', id: row.id, no: row.shipment_no })} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 font-mono">
                                <Ban size={11} /> Void
                            </button>
                        )}
                        {a?.can_update && (
                            <button onClick={() => setConfirm({ type: 'delete', id: row.id, no: row.shipment_no })} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 font-mono">
                                <Trash2Icon size={11} /> Delete
                            </button>
                        )}
                    </div>
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
                data={shipments}
                keyExtractor={(row) => row.id}
                searchFn={(row, q) =>
                    row.shipment_no.toLowerCase().includes(q) ||
                    row.sales_order_no.toLowerCase().includes(q) ||
                    (row.customer_name ?? '').toLowerCase().includes(q) ||
                    row.status.toLowerCase().includes(q)
                }
                searchPlaceholder="Search by shipment no, order, or status..."
                pageSize={meta.limit}
                pageSizeOptions={[10, 20, 50]}
                serverSide={{
                    total: meta.total,
                    page: meta.page,
                    totalPages: meta.totalPages,
                    onPageChange: (p) => fetchPage(p, meta.limit),
                    onPageSizeChange: (limit) => fetchPage(1, limit),
                }}
                emptyTitle="No shipments"
                emptyDescription="Create a shipment from a sales order"
            />
        </main>
    );
}
