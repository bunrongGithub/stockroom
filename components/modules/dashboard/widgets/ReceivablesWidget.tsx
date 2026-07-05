'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { DashboardReceivables } from '@/types/dashboard';

// Outstanding receivables: who owes money (top customers) and which unpaid
// invoices are oldest. Row schema is column-driven so a Due Date column can be
// appended later without touching the architecture.

function money(n: number) {
    return n.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

export default function ReceivablesWidget({
    receivables,
}: {
    receivables: DashboardReceivables;
}) {
    const router = useRouter();
    const { top_customers, oldest, invoice_count, total_outstanding } = receivables;

    return (
        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-baseline justify-between gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Outstanding Receivables
                </h3>
                <Link
                    href="/finances/invoice"
                    className="font-mono text-[11px] tabular-nums text-amber-600 hover:underline"
                >
                    {invoice_count} invoice{invoice_count === 1 ? '' : 's'} · ${' '}
                    {money(total_outstanding)}
                </Link>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
                {/* Top outstanding customers */}
                <div>
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Top Outstanding Customers
                    </p>
                    {top_customers.length === 0 ? (
                        <p className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-xs text-slate-400">
                            No customer owes money. 🎉
                        </p>
                    ) : (
                        <div className="divide-y divide-slate-50">
                            {top_customers.map((c) => (
                                <button
                                    key={c.customer}
                                    onClick={() => router.push('/finances/invoice')}
                                    className="flex w-full items-center gap-3 py-2 text-left transition-colors hover:bg-slate-50/60"
                                >
                                    <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-700">
                                        {c.customer}
                                    </span>
                                    <span className="shrink-0 font-mono text-[10px] text-slate-400">
                                        {c.invoices} unpaid
                                    </span>
                                    <span className="shrink-0 font-mono text-xs font-semibold tabular-nums text-amber-600">
                                        {money(c.outstanding)}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Oldest outstanding invoices (due-date column slots in later) */}
                <div>
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Oldest Unpaid Invoices
                    </p>
                    {oldest.length === 0 ? (
                        <p className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-xs text-slate-400">
                            Nothing outstanding.
                        </p>
                    ) : (
                        <div className="divide-y divide-slate-50">
                            {oldest.map((inv) => (
                                <Link
                                    key={inv.id}
                                    href={`/finances/invoice/${inv.id}/view`}
                                    className="flex items-center gap-3 py-2 transition-colors hover:bg-slate-50/60"
                                >
                                    <span className="w-28 shrink-0 truncate font-mono text-xs font-semibold text-sky-600">
                                        {inv.no}
                                    </span>
                                    <span className="min-w-0 flex-1 truncate text-xs text-slate-600">
                                        {inv.customer || '—'}
                                    </span>
                                    <span className="shrink-0 font-mono text-[10px] text-slate-400">
                                        {inv.date}
                                    </span>
                                    <span className="shrink-0 font-mono text-xs font-semibold tabular-nums text-amber-600">
                                        {money(inv.outstanding)}
                                    </span>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}
