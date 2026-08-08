'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * Document-page shell primitives.
 *
 * These encode the layout of the stock item form
 * (components/forms/inventory/stock/*) so that every document screen — sales
 * order, shipment, invoice, payment — renders the same card geometry,
 * typography and spacing rather than each re-inventing it. Field-level
 * primitives live in ./FieldLabel and ./Readonly.
 */

const BRAND = 'text-[#1a9e52]';

/* ── Page header ─────────────────────────────────────────────────────────── */

type HeaderActionTone = 'default' | 'primary' | 'info' | 'danger';

const HEADER_ACTION_TONE: Record<HeaderActionTone, string> = {
    default: 'border border-slate-200 text-slate-600 hover:bg-slate-50',
    primary:
        'bg-[#1a9e52] font-semibold text-white hover:bg-[#158042] border border-transparent',
    info: 'border border-sky-200 text-sky-600 hover:bg-sky-50',
    danger: 'border border-rose-200 text-rose-600 hover:bg-rose-50',
};

/**
 * A button in the page header's action bar.
 *
 * Every document screen puts its actions here rather than under the sidebar
 * summary, so Save / Discard / Post / Void sit in one predictable place no
 * matter which document you are on. Renders a Link when `href` is given.
 */
export function HeaderAction({
    label,
    icon,
    href,
    onClick,
    tone = 'default',
    disabled,
    type = 'button',
}: {
    label: ReactNode;
    icon?: ReactNode;
    href?: string;
    onClick?: () => void;
    tone?: HeaderActionTone;
    disabled?: boolean;
    type?: 'button' | 'submit';
}) {
    const className = `inline-flex shrink-0 items-center justify-center gap-2 rounded-xl px-4 py-2.5 transition-colors disabled:opacity-50 ${HEADER_ACTION_TONE[tone]}`;

    if (href && !disabled) {
        return (
            <Link href={href} className={className}>
                {icon}
                {label}
            </Link>
        );
    }
    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled}
            className={className}
        >
            {icon}
            {label}
        </button>
    );
}

/**
 * Page header: back link + icon-led title (with optional status badges) on the
 * left, the action bar on the right. The actions wrap onto their own line on
 * narrow screens rather than squeezing the title.
 */
export function FormHeader({
    backHref,
    onBackAction,
    backLabel = 'Back',
    icon,
    title,
    badges,
    subtitle,
    actions,
}: {
    backHref?: string;
    onBackAction?: () => void;
    backLabel?: string;
    icon?: ReactNode;
    title: ReactNode;
    badges?: ReactNode;
    subtitle?: ReactNode;
    actions?: ReactNode;
}) {
    const backClass =
        'inline-flex items-center gap-2 text-slate-500 transition-colors hover:text-slate-700';
    return (
        <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
                {backHref ? (
                    <Link href={backHref} className={backClass}>
                        <ArrowLeft size={16} /> {backLabel}
                    </Link>
                ) : onBackAction ? (
                    <button
                        type="button"
                        onClick={onBackAction}
                        className={backClass}
                    >
                        <ArrowLeft size={16} /> {backLabel}
                    </button>
                ) : null}
                <h2 className="mt-3 flex flex-wrap items-center gap-3 text-2xl font-bold text-slate-800 md:text-3xl">
                    {icon && <span className={BRAND}>{icon}</span>}
                    {title}
                    {badges}
                </h2>
                {subtitle && <p className="mt-1 text-slate-500">{subtitle}</p>}
            </div>
            {actions && (
                <div className="flex flex-wrap items-center gap-2">
                    {actions}
                </div>
            )}
        </div>
    );
}

/** Two-column page body: 350px sticky sidebar + fluid content. */
export function FormLayout({
    sidebar,
    children,
}: {
    sidebar: ReactNode;
    children: ReactNode;
}) {
    return (
        <div className="grid gap-6 xl:grid-cols-[350px_minmax(0,1fr)]">
            <aside className="space-y-4 self-start xl:sticky xl:top-6">
                {sidebar}
            </aside>
            <div className="min-w-0">{children}</div>
        </div>
    );
}

/**
 * Sidebar card — a tinted, icon-led header strip over a white body. Used for
 * the "Created By" / "Order Summary" style panels.
 */
export function SidebarCard({
    icon,
    title,
    children,
    bodyClassName = 'p-4',
}: {
    icon?: ReactNode;
    title: string;
    children: ReactNode;
    bodyClassName?: string;
}) {
    return (
        <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-50 bg-slate-50/80 px-4 py-2.5">
                {icon && <span className={BRAND}>{icon}</span>}
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    {title}
                </span>
            </div>
            <div className={bodyClassName}>{children}</div>
        </section>
    );
}

/**
 * A label/value line inside a SidebarCard summary.
 *
 * The value is allowed to shrink and truncate — without min-w-0 a long value
 * (a Khmer warehouse name, a full customer name) overflows the 350px sidebar
 * and paints over its own label.
 */
export function SummaryRow({
    label,
    children,
    strong,
    title,
}: {
    label: ReactNode;
    children: ReactNode;
    /** Emphasised total row, separated by a rule. */
    strong?: boolean;
    /** Tooltip for the full value when it truncates. */
    title?: string;
}) {
    return (
        <div
            className={`flex items-center justify-between gap-3 ${
                strong ? 'border-t pt-1.5 text-sm font-semibold' : ''
            }`}
        >
            <span className="shrink-0 text-slate-400">{label}</span>
            <span
                title={title}
                className={`min-w-0 truncate text-right ${
                    strong ? '' : 'font-semibold text-slate-700'
                }`}
            >
                {children}
            </span>
        </div>
    );
}

/**
 * Content card with an icon-led, uppercase section heading. `action` renders
 * flush right on the heading row (e.g. an "Add Item" button).
 */
export function SectionCard({
    icon,
    title,
    action,
    children,
}: {
    icon?: ReactNode;
    title?: string;
    action?: ReactNode;
    children: ReactNode;
}) {
    return (
        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            {(title || action) && (
                <div className="mb-4 flex items-center justify-between gap-3">
                    <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                        {icon && <span className={BRAND}>{icon}</span>}
                        {title}
                    </h3>
                    {action}
                </div>
            )}
            {children}
        </section>
    );
}

/** A row of form fields. Defaults to the two-column grid used by the item form. */
export function FieldGrid({
    cols = 2,
    children,
}: {
    cols?: 2 | 3 | 4;
    children: ReactNode;
}) {
    const layout =
        cols === 3
            ? 'sm:grid-cols-3'
            : cols === 4
              ? 'sm:grid-cols-2 lg:grid-cols-4'
              : 'lg:grid-cols-2';
    return <div className={`grid gap-4 ${layout}`}>{children}</div>;
}

export type ShellTab<T extends string> = {
    id: T;
    label: string;
    num?: number;
};

/**
 * Underlined tab strip. When a tab carries `num` it renders the numbered pill
 * used by the item form to signal step order.
 */
export function TabNav<T extends string>({
    tabs,
    active,
    onChangeAction,
}: {
    tabs: readonly ShellTab<T>[];
    active: T;
    onChangeAction: (id: T) => void;
}) {
    return (
        <div className="flex gap-0 overflow-x-auto border-b border-slate-200">
            {tabs.map((tab) => {
                const on = tab.id === active;
                return (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => onChangeAction(tab.id)}
                        className={`flex shrink-0 items-center gap-2 border-b-2 px-5 py-3 transition-all ${
                            on
                                ? 'border-[#1a9e52] text-[#1a9e52]'
                                : 'border-transparent text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        {tab.num !== undefined && (
                            <span
                                className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold transition-all ${
                                    on
                                        ? 'bg-[#1a9e52] text-white'
                                        : 'bg-slate-100 text-slate-500'
                                }`}
                            >
                                {tab.num}
                            </span>
                        )}
                        {tab.label}
                    </button>
                );
            })}
        </div>
    );
}

/** Panel wrapper for the content below the tab strip. */
export function TabPanel({ children }: { children: ReactNode }) {
    return <div className="space-y-5 pt-5">{children}</div>;
}

/** Outlined step button used for the prev/next links at the foot of a panel. */
export function StepButton({
    onClick,
    children,
}: {
    onClick: () => void;
    children: ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-2.5 text-slate-600 transition-colors hover:bg-slate-50"
        >
            {children}
        </button>
    );
}
