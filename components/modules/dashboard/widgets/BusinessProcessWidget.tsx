'use client';

import Link from 'next/link';
import { ChevronRightIcon } from 'lucide-react';
import type { DashboardSummary } from '@/types/dashboard';

// Business Process Overview: the sales pipeline left→right (matching the
// document flow users know from Related Documents). Each stage lists its REAL
// statuses with counts; every chip navigates to the stage's list. The goal:
// see at a glance where transactions are waiting.

function money(n: number) {
    return n.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

type Chip = { label: string; value: string; cls: string };

function Stage({
    title,
    href,
    chips,
}: {
    title: string;
    href: string;
    chips: Chip[];
}) {
    return (
        <div className="min-w-0 flex-1">
            <Link
                href={href}
                className="text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-700 hover:underline"
            >
                {title}
            </Link>
            <div className="mt-2 flex flex-wrap gap-1.5">
                {chips.map((c) => (
                    <Link
                        key={c.label}
                        href={href}
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[11px] font-medium transition-opacity hover:opacity-75 ${c.cls}`}
                    >
                        {c.label}
                        <span className="font-bold tabular-nums">{c.value}</span>
                    </Link>
                ))}
            </div>
        </div>
    );
}

export default function BusinessProcessWidget({
    summary,
}: {
    summary: DashboardSummary;
}) {
    const d = summary.documents;
    const ps = summary.invoice_payment_status;
    const pay = summary.payments.periods;
    const recv = summary.receivables;

    const n = (rec: Record<string, number>, key: string) => String(rec[key] ?? 0);

    return (
        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                Business Process Overview
            </h3>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-2">
                <Stage
                    title="Sales Orders"
                    href="/sale/order"
                    chips={[
                        { label: 'Open', value: n(d.orders, 'open'), cls: 'bg-emerald-50 text-emerald-700' },
                        { label: 'Partial', value: n(d.orders, 'partial_shipment'), cls: 'bg-amber-50 text-amber-700' },
                        { label: 'Closed', value: n(d.orders, 'closed'), cls: 'bg-sky-50 text-sky-700' },
                    ]}
                />
                <ChevronRightIcon size={16} className="hidden shrink-0 self-center text-slate-300 lg:block" />
                <Stage
                    title="Shipments"
                    href="/sale/delivery-note"
                    chips={[
                        { label: 'Draft', value: n(d.shipments, 'DRAFT'), cls: 'bg-slate-100 text-slate-600' },
                        { label: 'Shipped', value: n(d.shipments, 'POSTED'), cls: 'bg-emerald-50 text-emerald-700' },
                        { label: 'Part. Invoiced', value: n(d.shipments, 'PARTIALLY_INVOICED'), cls: 'bg-amber-50 text-amber-700' },
                        { label: 'Invoiced', value: n(d.shipments, 'INVOICED'), cls: 'bg-sky-50 text-sky-700' },
                    ]}
                />
                <ChevronRightIcon size={16} className="hidden shrink-0 self-center text-slate-300 lg:block" />
                <Stage
                    title="Sales Invoices"
                    href="/finances/invoice"
                    chips={[
                        { label: 'Draft', value: n(d.invoices, 'DRAFT'), cls: 'bg-slate-100 text-slate-600' },
                        { label: 'Unpaid', value: n(ps, 'UNPAID'), cls: 'bg-rose-50 text-rose-700' },
                        { label: 'Partially Paid', value: n(ps, 'PARTIALLY_PAID'), cls: 'bg-amber-50 text-amber-700' },
                        { label: 'Paid', value: n(ps, 'PAID'), cls: 'bg-emerald-50 text-emerald-700' },
                    ]}
                />
                <ChevronRightIcon size={16} className="hidden shrink-0 self-center text-slate-300 lg:block" />
                <Stage
                    title="Customer Payments"
                    href="/finances/payment"
                    chips={[
                        { label: 'Today', value: `${pay.today.count} · $${money(pay.today.total)}`, cls: 'bg-sky-50 text-sky-700' },
                        { label: 'Month', value: `${pay.month.count} · $${money(pay.month.total)}`, cls: 'bg-emerald-50 text-emerald-700' },
                        { label: 'Outstanding', value: `$${money(recv.total_outstanding)}`, cls: 'bg-amber-50 text-amber-700' },
                    ]}
                />
            </div>
        </section>
    );
}
