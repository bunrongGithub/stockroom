'use client';

import Link from 'next/link';
import type { DashboardDocuments } from '@/types/dashboard';

// Operational document status: one column per document type, one chip per
// status. Real lifecycle statuses (not idealized ones). Chips link to lists.

type ChipDef = { key: string; label: string; chipClass: string };

const ORDER_CHIPS: ChipDef[] = [
    { key: 'open', label: 'Open', chipClass: 'bg-emerald-50 text-emerald-700' },
    { key: 'partial_shipment', label: 'Partial Shipment', chipClass: 'bg-amber-50 text-amber-700' },
    { key: 'closed', label: 'Closed', chipClass: 'bg-sky-50 text-sky-700' },
    { key: 'cancelled', label: 'Cancelled', chipClass: 'bg-rose-50 text-rose-700' },
];

const SHIPMENT_CHIPS: ChipDef[] = [
    { key: 'DRAFT', label: 'Draft', chipClass: 'bg-slate-100 text-slate-600' },
    { key: 'POSTED', label: 'Shipped', chipClass: 'bg-emerald-50 text-emerald-700' },
    { key: 'PARTIALLY_INVOICED', label: 'Partially Invoiced', chipClass: 'bg-amber-50 text-amber-700' },
    { key: 'INVOICED', label: 'Invoiced', chipClass: 'bg-sky-50 text-sky-700' },
    { key: 'VOID', label: 'Void', chipClass: 'bg-rose-50 text-rose-700' },
];

const INVOICE_CHIPS: ChipDef[] = [
    { key: 'DRAFT', label: 'Draft', chipClass: 'bg-slate-100 text-slate-600' },
    { key: 'POSTED', label: 'Posted', chipClass: 'bg-emerald-50 text-emerald-700' },
    { key: 'CANCELLED', label: 'Cancelled', chipClass: 'bg-rose-50 text-rose-700' },
];

function StatusColumn({
    title,
    href,
    chips,
    counts,
}: {
    title: string;
    href: string;
    chips: ChipDef[];
    counts: Record<string, number>;
}) {
    return (
        <div className="min-w-0">
            <Link
                href={href}
                className="text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-700 hover:underline"
            >
                {title}
            </Link>
            <div className="mt-2 flex flex-wrap gap-1.5">
                {chips.map((c) => (
                    <Link
                        key={c.key}
                        href={href}
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[11px] font-medium transition-opacity hover:opacity-75 ${c.chipClass}`}
                    >
                        {c.label}
                        <span className="font-bold tabular-nums">
                            {counts[c.key] ?? 0}
                        </span>
                    </Link>
                ))}
            </div>
        </div>
    );
}

export default function DocumentStatusWidget({
    documents,
}: {
    documents: DashboardDocuments;
}) {
    return (
        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                Document Status
            </h3>
            <div className="grid gap-5 md:grid-cols-3">
                <StatusColumn
                    title="Sales Orders"
                    href="/sale/order"
                    chips={ORDER_CHIPS}
                    counts={documents.orders}
                />
                <StatusColumn
                    title="Shipments"
                    href="/sale/delivery-note"
                    chips={SHIPMENT_CHIPS}
                    counts={documents.shipments}
                />
                <StatusColumn
                    title="Sales Invoices"
                    href="/sale/invoice"
                    chips={INVOICE_CHIPS}
                    counts={documents.invoices}
                />
            </div>
        </section>
    );
}
