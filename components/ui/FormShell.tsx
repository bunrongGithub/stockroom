'use client';

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
