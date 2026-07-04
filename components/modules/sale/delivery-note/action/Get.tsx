'use client';

import { useRegisterModule } from '@/hook/useModule';
import type { ModuleProps } from '@/lib/registry';
import { saleInvoiceApi, saleOrderApi, saleShipmentApi } from '@/lib/api/sale';
import { RelatedDocumentsPanel } from '@/components/ui/RelatedDocuments';
import type {
    SalesInvoice,
    SalesInvoiceStatus,
    SalesOrder,
    SalesOrderStatus,
    SalesShipment,
    SalesShipmentStatus,
} from '@/types/sales/order-management';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    ArrowLeftIcon,
    Ban,
    FileText,
    Loader2Icon,
    Package,
    PackageIcon,
    PencilIcon,
    SendIcon,
} from 'lucide-react';

const TABS = [
    { id: 'details' as const, label: 'Details', num: 1 },
    { id: 'items' as const, label: 'Shipment Items', num: 2 },
    { id: 'related' as const, label: 'Related Documents', num: 3 },
];

function money(n: number) {
    return n.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

// Badge classes handed to the presentational RelatedDocumentsPanel.
const ORDER_STATUS_BADGE: Record<SalesOrderStatus, string> = {
    open: 'bg-emerald-100 text-emerald-700',
    partial_shipment: 'bg-amber-100 text-amber-700',
    closed: 'bg-sky-100 text-sky-700',
    cancelled: 'bg-rose-100 text-rose-700',
};
const INVOICE_STATUS_BADGE: Record<SalesInvoiceStatus, string> = {
    DRAFT: 'bg-gray-100 text-gray-600',
    POSTED: 'bg-emerald-100 text-emerald-700',
    CANCELLED: 'bg-rose-100 text-rose-700',
};
type TabId = (typeof TABS)[number]['id'];

function StatusBadge({ status }: { status: SalesShipmentStatus }) {
    const map: Record<SalesShipmentStatus, string> = {
        DRAFT: 'bg-gray-100 text-gray-600',
        POSTED: 'bg-emerald-100 text-emerald-700',
        VOID: 'bg-rose-100 text-rose-700',
        INVOICED: 'bg-sky-100 text-sky-700',
        PARTIALLY_INVOICED: 'bg-amber-100 text-amber-700',
    };
    return (
        <span
            className={`inline-block rounded-full px-3 py-1 text-xs font-mono font-semibold ${map[status]}`}
        >
            {status}
        </span>
    );
}

export default function SaleShipmentDetail({
    currentPath,
    permission,
    currentPathActions,
}: ModuleProps) {
    useRegisterModule({
        actionModules: currentPathActions,
        permission,
        modulePath: currentPath.path,
    });

    const router = useRouter();
    const params = useParams();
    const id = Array.isArray(params.slug) ? (params.slug.at(-2) ?? '') : '';

    const [activeTab, setActiveTab] = useState<TabId>('details');
    const [shipment, setShipment] = useState<SalesShipment | null>(null);
    const [order, setOrder] = useState<SalesOrder | null>(null);
    const [invoices, setInvoices] = useState<SalesInvoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [toast, setToast] = useState<{
        msg: string;
        type: 'success' | 'error';
    } | null>(null);
    const [busy, setBusy] = useState<'post' | 'void' | null>(null);

    function showToast(msg: string, type: 'success' | 'error') {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 4000);
    }

    async function load() {
        setLoading(true);
        try {
            const s = await saleShipmentApi.get(id);
            setShipment(s);
            setInvoices(await saleInvoiceApi.byShipment(s.id));
            if (s.sales_order_id) {
                setOrder(await saleOrderApi.get(s.sales_order_id));
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load shipment');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (id) load();
    }, [id]);

    async function handlePost() {
        if (!shipment) return;
        setBusy('post');
        try {
            await saleShipmentApi.post(shipment.id);
            showToast('Shipment posted — stock updated.', 'success');
            await load();
        } catch (e) {
            showToast(
                e instanceof Error ? e.message : 'Failed to post shipment',
                'error',
            );
        } finally {
            setBusy(null);
        }
    }

    async function handleVoid() {
        if (!shipment) return;
        setBusy('void');
        try {
            await saleShipmentApi.void(shipment.id);
            showToast('Shipment voided.', 'success');
            await load();
        } catch (e) {
            showToast(
                e instanceof Error ? e.message : 'Failed to void shipment',
                'error',
            );
        } finally {
            setBusy(null);
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2Icon className="animate-spin text-emerald-500" size={28} />
            </div>
        );
    }

    if (error || !shipment) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
                <PackageIcon className="text-muted-foreground" size={40} />
                <p className="text-sm text-muted-foreground">
                    {error || 'Shipment not found.'}
                </p>
                <button
                    onClick={() => router.push('/sale/delivery-note')}
                    className="text-xs text-sky-600 hover:underline"
                >
                    Back to list
                </button>
            </div>
        );
    }

    const a = shipment.actions;

    return (
        <div className="space-y-4 font-mono text-xs">
            {toast && (
                <div
                    className={`fixed right-4 top-4 z-50 rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}
                >
                    {toast.msg}
                </div>
            )}

            <div>
                <button
                    onClick={() => router.push('/sale/delivery-note')}
                    className="inline-flex items-center gap-2 text-slate-500 transition-colors hover:text-slate-700"
                >
                    <ArrowLeftIcon size={16} /> Back to Shipments
                </button>
                <h2 className="mt-3 flex items-center gap-3 text-2xl font-bold text-slate-800 md:text-3xl">
                    <Package className="text-[#1a9e52]" />
                    {shipment.shipment_no}
                    <StatusBadge status={shipment.status} />
                </h2>
            </div>

            <div className="grid gap-6 xl:grid-cols-[350px_minmax(0,1fr)]">
                {/* LEFT SIDEBAR — summary + actions */}
                <aside className="space-y-4 self-start xl:sticky xl:top-6">
                    <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
                        <div className="border-b border-slate-50 bg-slate-50/80 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                            Shipment Summary
                        </div>
                        <div className="space-y-2 p-4">
                            <div className="flex items-center justify-between">
                                <span className="text-slate-400">Order</span>
                                <button
                                    onClick={() =>
                                        router.push(
                                            `/sale/order/${shipment.sales_order_id}/view`,
                                        )
                                    }
                                    className="font-semibold text-sky-600 hover:underline"
                                >
                                    {shipment.sales_order_no}
                                </button>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-slate-400">Customer</span>
                                <span className="font-semibold text-slate-700">
                                    {shipment.customer_name || '—'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-slate-400">Delivery Date</span>
                                <span className="font-semibold text-slate-700">
                                    {shipment.delivery_date}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-slate-400">Warehouse</span>
                                <span className="font-semibold text-slate-700">
                                    {shipment.warehouse_name}
                                </span>
                            </div>
                        </div>
                    </section>

                    <div className="flex flex-col-reverse gap-2">
                        {a?.can_update && (
                            <button
                                onClick={() =>
                                    router.push(
                                        `/sale/delivery-note/${shipment.id}/update`,
                                    )
                                }
                                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-violet-200 px-4 py-2.5 text-violet-600 transition-colors hover:bg-violet-50"
                            >
                                <PencilIcon size={14} /> Edit
                            </button>
                        )}
                        {a?.can_void && (
                            <button
                                onClick={handleVoid}
                                disabled={busy !== null}
                                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-rose-700 transition-colors hover:bg-rose-100 disabled:opacity-60"
                            >
                                {busy === 'void' ? (
                                    <Loader2Icon size={14} className="animate-spin" />
                                ) : (
                                    <Ban size={14} />
                                )}
                                Void
                            </button>
                        )}
                        {a?.can_post && (
                            <button
                                onClick={handlePost}
                                disabled={busy !== null}
                                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1a9e52] px-4 py-2.5 font-semibold text-white transition-colors hover:bg-[#158042] disabled:opacity-60"
                            >
                                {busy === 'post' ? (
                                    <Loader2Icon size={14} className="animate-spin" />
                                ) : (
                                    <SendIcon size={14} />
                                )}
                                Post
                            </button>
                        )}
                        {a?.can_invoice && (
                            <button
                                onClick={() => {
                                    if (typeof window !== 'undefined')
                                        sessionStorage.setItem(
                                            'pending_invoice_shipment_id',
                                            String(shipment.id),
                                        );
                                    router.push('/sale/invoice/create');
                                }}
                                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1a9e52] px-4 py-2.5 font-semibold text-white transition-colors hover:bg-[#158042]"
                            >
                                <FileText size={14} /> Create Invoice
                            </button>
                        )}
                    </div>
                </aside>

                {/* RIGHT — tabs */}
                <div className="min-w-0">
                    <div className="flex gap-0 border-b border-slate-200">
                        {TABS.map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 border-b-2 px-5 py-3 transition-all ${
                                    activeTab === tab.id
                                        ? 'border-[#1a9e52] text-[#1a9e52]'
                                        : 'border-transparent text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                <span
                                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold transition-all ${
                                        activeTab === tab.id
                                            ? 'bg-[#1a9e52] text-white'
                                            : 'bg-slate-100 text-slate-500'
                                    }`}
                                >
                                    {tab.num}
                                </span>
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Tab 1: Details */}
                    {activeTab === 'details' && (
                        <div className="space-y-5 pt-5">
                            <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                                <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                                    Shipment Information
                                </h3>
                                <div className="grid grid-cols-2 gap-y-3">
                                    <span className="text-slate-400">Reference No</span>
                                    <span>{shipment.reference_no || '—'}</span>
                                    <span className="text-slate-400">Customer</span>
                                    <span className="font-medium">
                                        {shipment.customer_name || '—'}
                                    </span>
                                    <span className="text-slate-400">Customer Phone</span>
                                    <span>{shipment.customer_phone || '—'}</span>
                                    <span className="text-slate-400">Delivery Date</span>
                                    <span>{shipment.delivery_date}</span>
                                    <span className="text-slate-400">Warehouse</span>
                                    <span>{shipment.warehouse_name}</span>
                                    <span className="text-slate-400">Receiver</span>
                                    <span>{shipment.receiver_name || '—'}</span>
                                    <span className="text-slate-400">Address</span>
                                    <span>{shipment.delivery_address || '—'}</span>
                                    {shipment.notes && (
                                        <>
                                            <span className="text-slate-400">Notes</span>
                                            <span>{shipment.notes}</span>
                                        </>
                                    )}
                                </div>
                                <p className="mt-4 text-[11px] text-slate-400">
                                    Last updated{' '}
                                    {new Date(shipment.updated_at).toLocaleString()}
                                </p>
                            </section>
                        </div>
                    )}

                    {/* Tab 2: Shipment Items */}
                    {activeTab === 'items' && (
                        <div className="space-y-5 pt-5">
                            <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                                <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                                    Shipment Items
                                </h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs font-mono">
                                        <thead>
                                            <tr className="border-b text-muted-foreground">
                                                <th className="text-left py-2 pr-3 font-medium">
                                                    Product
                                                </th>
                                                <th className="text-left py-2 pr-3 font-medium">
                                                    Location
                                                </th>
                                                <th className="text-left py-2 pr-3 font-medium">
                                                    UOM
                                                </th>
                                                <th className="text-right py-2 pr-3 font-medium">
                                                    Ordered
                                                </th>
                                                <th className="text-right py-2 pr-3 font-medium">
                                                    Prev. Shipped
                                                </th>
                                                <th className="text-right py-2 pr-3 font-medium">
                                                    Shipment Qty
                                                </th>
                                                <th className="text-left py-2 font-medium">
                                                    Serials
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {shipment.items.map((item) => (
                                                <tr
                                                    key={item.id}
                                                    className="border-b hover:bg-muted/20"
                                                >
                                                    <td className="py-2 pr-3 font-medium">
                                                        {item.product_name}
                                                    </td>
                                                    <td className="py-2 pr-3">
                                                        {item.location_name || '—'}
                                                    </td>
                                                    <td className="py-2 pr-3">
                                                        {item.uom || '—'}
                                                    </td>
                                                    <td className="py-2 pr-3 text-right">
                                                        {item.ordered_qty}
                                                    </td>
                                                    <td className="py-2 pr-3 text-right">
                                                        {item.previously_shipped_qty}
                                                    </td>
                                                    <td className="py-2 pr-3 text-right font-semibold text-emerald-600">
                                                        {item.shipment_qty}
                                                    </td>
                                                    <td className="py-2 text-slate-500">
                                                        {item.serial_numbers?.length
                                                            ? item.serial_numbers.join(', ')
                                                            : '—'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </section>
                        </div>
                    )}

                    {/* Tab 3: Related Documents (document flow) */}
                    {activeTab === 'related' && (
                        <div className="space-y-5 pt-5">
                            {(() => {
                                const shippedTotal = shipment.items.reduce(
                                    (s, i) => s + i.shipment_qty,
                                    0,
                                );
                                const invoicedTotal = invoices
                                    .filter((iv) => iv.status !== 'CANCELLED')
                                    .reduce((s, iv) => s + iv.total_quantity, 0);
                                const remaining = shippedTotal - invoicedTotal;
                                return (
                                    <RelatedDocumentsPanel
                                        source={
                                            order
                                                ? [
                                                      {
                                                          key: `so-${order.id}`,
                                                          docType: 'Sales Order',
                                                          number: order.order_no,
                                                          href: `/sale/order/${order.id}/view`,
                                                          date: order.order_date,
                                                          status: order.status.replace('_', ' '),
                                                          statusClass:
                                                              ORDER_STATUS_BADGE[order.status],
                                                          meta: [
                                                              {
                                                                  label: 'Customer',
                                                                  value: order.customer_name,
                                                              },
                                                              {
                                                                  label: 'Qty',
                                                                  value: String(
                                                                      order.items.reduce(
                                                                          (s, i) => s + i.ordered_qty,
                                                                          0,
                                                                      ),
                                                                  ),
                                                              },
                                                              {
                                                                  label: 'Total',
                                                                  value: `${order.currency} ${money(order.grand_total)}`,
                                                              },
                                                          ],
                                                      },
                                                  ]
                                                : []
                                        }
                                        generated={invoices.map((iv) => ({
                                            key: `inv-${iv.id}`,
                                            docType: 'Invoice',
                                            number: iv.invoice_no,
                                            href: `/sale/invoice/${iv.id}/view`,
                                            date: iv.invoice_date,
                                            status: iv.status,
                                            statusClass: INVOICE_STATUS_BADGE[iv.status],
                                            meta: [
                                                { label: 'Qty', value: String(iv.total_quantity) },
                                                {
                                                    label: 'Total',
                                                    value: `${iv.currency} ${money(iv.grand_total)}`,
                                                },
                                            ],
                                        }))}
                                        generatedEmptyText="No invoices created for this shipment yet."
                                        summary={
                                            <div className="flex gap-4 font-mono text-xs">
                                                <span className="text-slate-400">
                                                    Shipped{' '}
                                                    <span className="font-semibold text-slate-700">
                                                        {shippedTotal}
                                                    </span>
                                                </span>
                                                <span className="text-emerald-600">
                                                    Invoiced{' '}
                                                    <span className="font-semibold">
                                                        {invoicedTotal}
                                                    </span>
                                                </span>
                                                <span
                                                    className={
                                                        remaining > 0
                                                            ? 'text-amber-600'
                                                            : 'text-slate-400'
                                                    }
                                                >
                                                    Remaining{' '}
                                                    <span className="font-semibold">
                                                        {remaining}
                                                    </span>
                                                </span>
                                            </div>
                                        }
                                    />
                                );
                            })()}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
