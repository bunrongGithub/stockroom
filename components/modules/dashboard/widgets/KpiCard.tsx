'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

// Stat tile (dataviz: a single headline number is NOT a chart). Value is the
// hero; label and icon stay muted. `tone` is reserved for true status
// semantics (low/out-of-stock warnings) — never used as decoration.
export type KpiTone = 'default' | 'warning' | 'danger';

const TONE_ICON: Record<KpiTone, string> = {
    default: 'bg-slate-100 text-slate-500',
    warning: 'bg-amber-50 text-amber-600',
    danger: 'bg-rose-50 text-rose-600',
};

export default function KpiCard({
    label,
    value,
    href,
    icon: Icon,
    tone = 'default',
    sub,
}: {
    label: string;
    value: string;
    href: string;
    icon: LucideIcon;
    tone?: KpiTone;
    sub?: string;
}) {
    return (
        <Link
            href={href}
            className="group flex items-start gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-colors hover:border-slate-200 hover:bg-slate-50/60"
        >
            <span
                className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${TONE_ICON[tone]}`}
            >
                <Icon size={15} />
            </span>
            <span className="min-w-0">
                <span className="block truncate text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {label}
                </span>
                <span className="block font-mono text-xl font-bold tabular-nums text-slate-800">
                    {value}
                </span>
                {sub && (
                    <span className="block text-[10px] text-slate-400">{sub}</span>
                )}
            </span>
        </Link>
    );
}
