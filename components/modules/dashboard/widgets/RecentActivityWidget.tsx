'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { DashboardRecentRow, DashboardSummary } from '@/types/dashboard';

// Recent activity: 5 latest documents per type, tabbed. Rows link to detail.

const TABS = [
  {
    id: 'orders' as const,
    label: 'Orders',
    href: (id: number) => `/sale/order/${id}/view`,
  },
  {
    id: 'shipments' as const,
    label: 'Shipments',
    href: (id: number) => `/sale/delivery-note/${id}/view`,
  },
  {
    id: 'invoices' as const,
    label: 'Invoices',
    href: (id: number) => `/finances/invoice/${id}/view`,
  },
];
type TabId = (typeof TABS)[number]['id'];

const STATUS_CHIP: Record<string, string> = {
  // orders
  open: 'bg-emerald-50 text-emerald-700',
  partial_shipment: 'bg-amber-50 text-amber-700',
  closed: 'bg-sky-50 text-sky-700',
  cancelled: 'bg-rose-50 text-rose-700',
  // shipments / invoices
  DRAFT: 'bg-slate-100 text-slate-600',
  POSTED: 'bg-emerald-50 text-emerald-700',
  PARTIALLY_INVOICED: 'bg-amber-50 text-amber-700',
  INVOICED: 'bg-sky-50 text-sky-700',
  VOID: 'bg-rose-50 text-rose-700',
  CANCELLED: 'bg-rose-50 text-rose-700',
};

export default function RecentActivityWidget({
  recent,
}: {
  recent: DashboardSummary['recent'];
}) {
  const [activeTab, setActiveTab] = useState<TabId>('orders');
  const tab = TABS.find((t) => t.id === activeTab)!;
  const rows: DashboardRecentRow[] = recent[activeTab] ?? [];

  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
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
          No {tab.label.toLowerCase()} yet.
        </p>
      ) : (
        <div className="divide-y divide-slate-50">
          {rows.map((r) => (
            <Link
              key={r.id}
              href={tab.href(r.id)}
              className="flex items-center gap-3 py-2 transition-colors hover:bg-slate-50/60"
            >
              <span className="w-40 shrink-0 truncate font-mono text-xs font-semibold text-sky-600">
                {r.no}
              </span>
              <span className="min-w-0 flex-1 truncate text-xs text-slate-600">
                {r.customer || '—'}
              </span>
              <span className="shrink-0 font-mono text-[11px] text-slate-400">
                {r.date}
              </span>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] font-medium ${
                  STATUS_CHIP[r.status] ?? 'bg-slate-100 text-slate-600'
                }`}
              >
                {r.status.replace('_', ' ')}
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
