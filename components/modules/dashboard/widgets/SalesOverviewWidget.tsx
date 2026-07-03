'use client';

import type { DashboardSales } from '@/types/dashboard';

// Sales overview: period table + last-7-days single-series bar chart.
// Dataviz rules applied: one hue for one series (no legend needed — the title
// names it), thin rounded bars anchored to the baseline with surface gaps,
// hover tooltips on every mark, ONE selective direct label (the max day),
// text in text tokens — never the series color.

function money(n: number) {
    return n.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

const PERIODS = [
    ['today', 'Today'],
    ['yesterday', 'Yesterday'],
    ['week', 'This Week'],
    ['month', 'This Month'],
] as const;

export default function SalesOverviewWidget({ sales }: { sales: DashboardSales }) {
    const daily = sales.daily ?? [];
    const max = Math.max(...daily.map((d) => d.total), 0);
    const allZero = max <= 0;

    return (
        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                Sales Overview
            </h3>

            <table className="w-full font-mono text-xs tabular-nums">
                <thead>
                    <tr className="border-b text-[10px] uppercase tracking-wider text-slate-400">
                        <th className="py-1.5 text-left font-bold">Period</th>
                        <th className="py-1.5 text-right font-bold">Total Sales</th>
                        <th className="py-1.5 text-right font-bold">Invoices</th>
                        <th className="py-1.5 text-right font-bold">Avg Invoice</th>
                    </tr>
                </thead>
                <tbody>
                    {PERIODS.map(([key, label]) => {
                        const p = sales.periods[key];
                        const avg = p.invoices > 0 ? p.total / p.invoices : 0;
                        return (
                            <tr key={key} className="border-b border-slate-50">
                                <td className="py-2 text-slate-500">{label}</td>
                                <td className="py-2 text-right font-semibold text-slate-800">
                                    {money(p.total)}
                                </td>
                                <td className="py-2 text-right text-slate-600">
                                    {p.invoices}
                                </td>
                                <td className="py-2 text-right text-slate-600">
                                    {money(avg)}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>

            {/* Last 7 days — single-series bars */}
            <p className="mt-4 mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Last 7 Days
            </p>
            {allZero ? (
                <p className="rounded-xl border border-dashed border-slate-200 py-4 text-center text-xs text-slate-400">
                    No posted sales in the last 7 days.
                </p>
            ) : (
                <div className="flex h-16 items-end gap-[2px]">
                    {daily.map((d) => {
                        const h = max > 0 ? Math.max((d.total / max) * 100, 2) : 2;
                        const isMax = d.total === max && d.total > 0;
                        const day = new Date(d.day).toLocaleDateString('en-GB', {
                            weekday: 'short',
                            day: '2-digit',
                            month: 'short',
                        });
                        return (
                            <div
                                key={d.day}
                                className="group relative flex h-full flex-1 flex-col justify-end"
                                title={`${day}: ${money(d.total)}`}
                            >
                                {isMax && (
                                    <span className="mb-0.5 truncate text-center font-mono text-[9px] font-semibold tabular-nums text-slate-500">
                                        {money(d.total)}
                                    </span>
                                )}
                                <div
                                    className={`rounded-t-[4px] transition-colors ${
                                        d.total > 0
                                            ? 'bg-[#1a9e52] group-hover:bg-[#158042]'
                                            : 'bg-slate-100'
                                    }`}
                                    style={{ height: `${h}%` }}
                                />
                            </div>
                        );
                    })}
                </div>
            )}
            <div className="mt-1 flex gap-[2px]">
                {daily.map((d) => (
                    <span
                        key={d.day}
                        className="flex-1 text-center text-[9px] text-slate-400"
                    >
                        {new Date(d.day).toLocaleDateString('en-GB', {
                            weekday: 'narrow',
                        })}
                    </span>
                ))}
            </div>
        </section>
    );
}
