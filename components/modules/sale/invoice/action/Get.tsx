'use client';

import { useRegisterModule } from '@/hook/useModule';
import type { ModuleProps } from '@/lib/registry';
import { saleInvoiceApi } from '@/lib/api/sale';
import type {
    SalesInvoice,
    SalesInvoiceStatus,
} from '@/types/sales/order-management';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    ArrowLeftIcon,
    Ban,
    FileText,
    FileWarning,
    Loader2Icon,
    PencilIcon,
    SendIcon,
    Trash2Icon,
} from 'lucide-react';

const TABS = [
    { id: 'info' as const, label: 'Invoice Information', num: 1 },
    { id: 'items' as const, label: 'Items', num: 2 },
];
type TabId = (typeof TABS)[number]['id'];

function StatusBadge({ status }: { status: SalesInvoiceStatus }) {
    const map: Record<SalesInvoiceStatus, string> = {
        DRAFT: 'bg-gray-100 text-gray-600',
        POSTED: 'bg-emerald-100 text-emerald-700',
        CANCELLED: 'bg-rose-100 text-rose-700',
    };
    return (
        <span
            className={`inline-block rounded-full px-3 py-1 text-xs font-mono font-semibold ${map[status]}`}
        >
            {status}
        </span>
    );
}

function fmt(n: number) {
    return n.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

export default function SaleInvoiceDetail({
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

    const [activeTab, setActiveTab] = useState<TabId>('info');
    const [invoice, setInvoice] = useState<SalesInvoice | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(
        null,
    );
    const [busy, setBusy] = useState<'post' | 'cancel' | 'delete' | null>(null);

    function showToast(msg: string, type: 'success' | 'error') {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 4000);
    }

    async function load() {
        setLoading(true);
        try {
            setInvoice(await saleInvoiceApi.get(id));
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load invoice');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (id) load();
    }, [id]);

    async function handlePost() {
        if (!invoice) return;
        setBusy('post');
        try {
            await saleInvoiceApi.post(invoice.id);
            showToast('Invoice posted.', 'success');
            await load();
        } catch (e) {
            showToast(e instanceof Error ? e.message : 'Failed to post invoice', 'error');
        } finally {
            setBusy(null);
        }
    }

    async function handleCancel() {
        if (!invoice) return;
        setBusy('cancel');
        try {
            await saleInvoiceApi.cancel(invoice.id);
            showToast('Invoice cancelled.', 'success');
            await load();
        } catch (e) {
            showToast(e instanceof Error ? e.message : 'Failed to cancel invoice', 'error');
        } finally {
            setBusy(null);
        }
    }

    async function handleDelete() {
        if (!invoice) return;
        setBusy('delete');
        try {
            await saleInvoiceApi.remove(invoice.id);
            showToast('Invoice deleted.', 'success');
            router.push('/sale/invoice');
        } catch (e) {
            showToast(e instanceof Error ? e.message : 'Failed to delete invoice', 'error');
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

    if (error || !invoice) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
                <FileWarning className="text-muted-foreground" size={40} />
                <p className="text-sm text-muted-foreground">{error || 'Invoice not found.'}</p>
                <button
                    onClick={() => router.push('/sale/invoice')}
                    className="text-xs text-sky-600 hover:underline"
                >
                    Back to list
                </button>
            </div>
        );
    }

    const a = invoice.actions;

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
                    onClick={() => router.push('/sale/invoice')}
                    className="inline-flex items-center gap-2 text-slate-500 transition-colors hover:text-slate-700"
                >
                    <ArrowLeftIcon size={16} /> Back to Invoices
                </button>
                <h2 className="mt-3 flex items-center gap-3 text-2xl font-bold text-slate-800 md:text-3xl">
                    <FileText className="text-[#1a9e52]" />
                    {invoice.invoice_no}
                    <StatusBadge status={invoice.status} />
                </h2>
            </div>

            <div className="grid gap-6 xl:grid-cols-[350px_minmax(0,1fr)]">
                {/* LEFT SIDEBAR */}
                <aside className="space-y-4 self-start xl:sticky xl:top-6">
                    <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
                        <div className="border-b border-slate-50 bg-slate-50/80 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                            Invoice Summary
                        </div>
                        <div className="space-y-2 p-4">
                            <div className="flex items-center justify-between">
                                <span className="text-slate-400">Customer</span>
                                <span className="font-semibold text-slate-700">
                                    {invoice.customer_name || '—'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-slate-400">Invoice Date</span>
                                <span className="font-semibold text-slate-700">
                                    {invoice.invoice_date}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-slate-400">Shipment</span>
                                <button
                                    onClick={() =>
                                        router.push(`/sale/delivery-note/${invoice.shipment_id}/view`)
                                    }
                                    className="font-semibold text-sky-600 hover:underline"
                                >
                                    {invoice.shipment_no}
                                </button>
                            </div>
                            {invoice.sales_order_id && (
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-400">Sales Order</span>
                                    <button
                                        onClick={() =>
                                            router.push(`/sale/order/${invoice.sales_order_id}/view`)
                                        }
                                        className="font-semibold text-sky-600 hover:underline"
                                    >
                                        {invoice.sales_order_no}
                                    </button>
                                </div>
                            )}
                            <div className="mt-2 space-y-1.5 rounded-xl bg-slate-50 p-3">
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Subtotal</span>
                                    <span>{fmt(invoice.subtotal)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Discount</span>
                                    <span className="text-rose-500">- {fmt(invoice.discount_total)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Tax</span>
                                    <span>{fmt(invoice.tax_total)}</span>
                                </div>
                                <div className="flex justify-between border-t pt-1.5 text-sm font-semibold">
                                    <span>Grand Total</span>
                                    <span>
                                        {invoice.currency} {fmt(invoice.grand_total)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </section>

                    {(a?.can_update || a?.can_post || a?.can_cancel || a?.can_delete) && (
                        <div className="flex flex-col gap-2">
                            {a?.can_update && (
                                <button
                                    onClick={() => router.push(`/sale/invoice/${invoice.id}/update`)}
                                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-violet-200 px-4 py-2.5 text-violet-600 transition-colors hover:bg-violet-50"
                                >
                                    <PencilIcon size={14} /> Edit
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
                            {a?.can_cancel && (
                                <button
                                    onClick={handleCancel}
                                    disabled={busy !== null}
                                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-rose-700 transition-colors hover:bg-rose-100 disabled:opacity-60"
                                >
                                    {busy === 'cancel' ? (
                                        <Loader2Icon size={14} className="animate-spin" />
                                    ) : (
                                        <Ban size={14} />
                                    )}
                                    Cancel Invoice
                                </button>
                            )}
                            {a?.can_delete && (
                                <button
                                    onClick={handleDelete}
                                    disabled={busy !== null}
                                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 px-4 py-2.5 text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-60"
                                >
                                    {busy === 'delete' ? (
                                        <Loader2Icon size={14} className="animate-spin" />
                                    ) : (
                                        <Trash2Icon size={14} />
                                    )}
                                    Delete
                                </button>
                            )}
                        </div>
                    )}
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

                    {activeTab === 'info' && (
                        <div className="space-y-5 pt-5">
                            <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                                <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                                    Invoice Information
                                </h3>
                                <div className="grid grid-cols-2 gap-y-3">
                                    <span className="text-slate-400">Customer</span>
                                    <span className="font-medium">{invoice.customer_name || '—'}</span>
                                    <span className="text-slate-400">Customer Phone</span>
                                    <span>{invoice.customer_phone || '—'}</span>
                                    <span className="text-slate-400">Customer Address</span>
                                    <span>{invoice.customer_address || '—'}</span>
                                    <span className="text-slate-400">Invoice Date</span>
                                    <span>{invoice.invoice_date}</span>
                                    <span className="text-slate-400">Currency</span>
                                    <span>{invoice.currency}</span>
                                    <span className="text-slate-400">Exchange Rate</span>
                                    <span>{invoice.exchange_rate}</span>
                                    {invoice.remarks && (
                                        <>
                                            <span className="text-slate-400">Remarks</span>
                                            <span>{invoice.remarks}</span>
                                        </>
                                    )}
                                </div>
                                <p className="mt-4 text-[11px] text-slate-400">
                                    Last updated {new Date(invoice.updated_at).toLocaleString()}
                                </p>
                            </section>
                        </div>
                    )}

                    {activeTab === 'items' && (
                        <div className="space-y-5 pt-5">
                            <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                                <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                                    Items
                                </h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs font-mono">
                                        <thead>
                                            <tr className="border-b text-muted-foreground">
                                                <th className="text-left py-2 pr-3 font-medium">Item</th>
                                                <th className="text-left py-2 pr-3 font-medium">UOM</th>
                                                <th className="text-right py-2 pr-3 font-medium">Qty</th>
                                                <th className="text-right py-2 pr-3 font-medium">Price</th>
                                                <th className="text-right py-2 pr-3 font-medium">Disc %</th>
                                                <th className="text-right py-2 pr-3 font-medium">Tax %</th>
                                                <th className="text-right py-2 font-medium">Line Total</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {invoice.items.map((item) => (
                                                <tr key={item.id} className="border-b hover:bg-muted/20">
                                                    <td className="py-2 pr-3 font-medium">{item.product_name}</td>
                                                    <td className="py-2 pr-3">{item.uom || '—'}</td>
                                                    <td className="py-2 pr-3 text-right">{item.quantity}</td>
                                                    <td className="py-2 pr-3 text-right">{fmt(item.unit_price)}</td>
                                                    <td className="py-2 pr-3 text-right">{item.discount}%</td>
                                                    <td className="py-2 pr-3 text-right">{item.tax}%</td>
                                                    <td className="py-2 text-right font-semibold">{fmt(item.line_total)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="mt-4 flex justify-end">
                                    <div className="w-56 space-y-1.5 text-xs font-mono">
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Subtotal</span>
                                            <span>{fmt(invoice.subtotal)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Discount</span>
                                            <span className="text-rose-500">- {fmt(invoice.discount_total)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Tax</span>
                                            <span>{fmt(invoice.tax_total)}</span>
                                        </div>
                                        <div className="flex justify-between border-t pt-1.5 text-sm font-semibold">
                                            <span>Grand Total</span>
                                            <span>
                                                {invoice.currency} {fmt(invoice.grand_total)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </section>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
