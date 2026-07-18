'use client';

import { AlertCircle } from 'lucide-react';
import type { AnalyticsRangeKey } from '@/types/analytics';
import { RANGE_OPTIONS } from './useAnalyticsSeries';

/**
 * Shared shell for dashboard analytics charts: title, an independent
 * date-range filter, and loading / error / empty states in a fixed-height
 * plot area (no layout shift between states).
 */
export default function AnalyticsChartCard({
    title,
    range,
    onRangeChange,
    loading,
    error,
    empty,
    emptyText,
    onRetry,
    children,
}: {
    title: string;
    range: AnalyticsRangeKey;
    onRangeChange: (r: AnalyticsRangeKey) => void;
    loading: boolean;
    error: string;
    empty: boolean;
    emptyText: string;
    onRetry: () => void;
    children: React.ReactNode;
}) {
    return (
        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    {title}
                </h3>
                <select
                    value={range}
                    onChange={(e) => onRangeChange(e.target.value as AnalyticsRangeKey)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 font-mono text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                >
                    {RANGE_OPTIONS.map((o) => (
                        <option key={o.key} value={o.key}>
                            {o.label}
                        </option>
                    ))}
                </select>
            </div>

            <div className="relative h-64">
                {loading ? (
                    <div className="h-full animate-pulse rounded-xl bg-slate-50" />
                ) : error ? (
                    <div className="flex h-full flex-col items-center justify-center gap-2">
                        <AlertCircle className="text-rose-400" size={24} />
                        <p className="text-xs text-slate-500">{error}</p>
                        <button
                            onClick={onRetry}
                            className="rounded-xl border px-3 py-1.5 font-mono text-xs text-slate-600 hover:bg-slate-50"
                        >
                            Retry
                        </button>
                    </div>
                ) : empty ? (
                    <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200">
                        <p className="text-xs text-slate-400">{emptyText}</p>
                    </div>
                ) : (
                    children
                )}
            </div>
        </section>
    );
}
