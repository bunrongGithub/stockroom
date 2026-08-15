'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { DashboardRecentRow, DashboardSummary } from '@/types/dashboard';

// Recent business activity. Default "All" tab = unified timeline: the four
// document types merged client-side by created_at (the RPC ships created_at +
// amount on every recent row — no extra query). Per-type tabs remain.

type DocType = 'orders' | 'shipments' | 'invoices' | 'payments';

const DOC_META: Record<
    DocType,
    { chip: string; label: string; href: (id: number) => string }
> = {
    orders: {
        chip: 'bg-emerald-50 text-emerald-700',
        label: 'Order',
        href: (id) => `/sale/order/${id}/view`,
    },
    shipments: {
        chip: 'bg-violet-50 text-violet-700',
        label: 'Delivery',
        href: (id) => `/sale/delivery-note/${id}/view`,
    },
    invoices: {
        chip: 'bg-sky-50 text-sky-700',
        label: 'Invoice',
        href: (id) => `/finances/invoice/${id}/view`,
    },
    payments: {
        chip: 'bg-amber-50 text-amber-700',
        label: 'Payment',
        href: (id) => `/finances/payment/${id}/view`,
    },
};

const TABS = [
    { id: 'all' as const, label: 'All' },
    { id: 'orders' as const, label: 'Orders' },
    { id: 'shipments' as const, label: 'Delivery' },
    { id: 'invoices' as const, label: 'Invoices' },
    { id: 'payments' as const, label: 'Payments' },
];
type TabId = (typeof TABS)[number]['id'];

const STATUS_CHIP: Record<string, string> = {
    open: 'bg-emerald-50 text-emerald-700',
    partial_shipment: 'bg-amber-50 text-amber-700',
    closed: 'bg-sky-50 text-sky-700',
    cancelled: 'bg-rose-50 text-rose-700',
    DRAFT: 'bg-slate-100 text-slate-600',
    POSTED: 'bg-emerald-50 text-emerald-700',
    PARTIALLY_INVOICED: 'bg-amber-50 text-amber-700',
    INVOICED: 'bg-sky-50 text-sky-700',
    VOID: 'bg-rose-50 text-rose-700',
    CANCELLED: 'bg-rose-50 text-rose-700',
};

function money(n: number) {
    return n.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function timeOf(iso: string) {
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
        ? ''
        : d.toLocaleString('en-GB', {
              day: '2-digit',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
          });
}

type TimelineRow = DashboardRecentRow & { type: DocType };

export default function RecentActivityWidget({
    recent,
}: {
    recent: DashboardSummary['recent'];
}) {
    const [activeTab, setActiveTab] = useState<TabId>('all');

    const timeline: TimelineRow[] = (
        ['orders', 'shipments', 'invoices', 'payments'] as DocType[]
    )
        .flatMap((type) => (recent[type] ?? []).map((r) => ({ ...r, type })))
        .sort(
            (a, b) =>
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        )
        .slice(0, 12);

    const rows: TimelineRow[] =
        activeTab === 'all'
            ? timeline
            : (recent[activeTab] ?? []).map((r) => ({ ...r, type: activeTab }));

    return (
        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Recent Activity
                </h3>
                <div className="flex gap-1">
                    {TABS.map((t) => (
                        <button
                            key={t.id}
                            type="button"
                            onClick={() => setActiveTab(t.id)}
                            className={`rounded-lg px-2.5 py-1 font-mono text-[11px] transition-colors ${
                                activeTab === t.id
                                    ? 'bg-slate-800 text-white'
                                    : 'text-slate-500 hover:bg-slate-100'
                            }`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
            </div>

            {rows.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-xs text-slate-400">
                    No activity yet.
                </p>
            ) : (
                <div className="divide-y divide-slate-50">
                    {rows.map((r) => {
                        const meta = DOC_META[r.type];
                        return (
                            <Link
                                key={`${r.type}-${r.id}`}
                                href={meta.href(r.id)}
                                className="flex items-center gap-3 py-2 transition-colors hover:bg-slate-50/60"
                            >
                                <span className="w-24 shrink-0 font-mono text-[10px] text-slate-400">
                                    {timeOf(r.created_at)}
                                </span>
                                <span
                                    className={`w-18 shrink-0 rounded-full px-2 py-0.5 text-center font-mono text-[10px] font-medium ${meta.chip}`}
                                >
                                    {meta.label}
                                </span>
                                <span className="w-32 shrink-0 truncate font-mono text-xs font-semibold text-sky-600">
                                    {r.no}
                                </span>
                                <span className="min-w-0 flex-1 truncate text-xs text-slate-600">
                                    {r.customer || '—'}
                                </span>
                                {r.amount != null && (
                                    <span className="shrink-0 font-mono text-xs font-semibold tabular-nums text-slate-700">
                                        $ {money(r.amount)}
                                    </span>
                                )}
                                <span
                                    className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] font-medium ${
                                        STATUS_CHIP[r.status] ??
                                        'bg-slate-100 text-slate-600'
                                    }`}
                                >
                                    {r.status.replace('_', ' ')}
                                </span>
                            </Link>
                        );
                    })}
                </div>
            )}
        </section>
    );
}
