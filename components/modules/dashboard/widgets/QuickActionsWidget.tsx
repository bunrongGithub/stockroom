'use client';

import Link from 'next/link';
import {
  FileTextIcon,
  PackagePlusIcon,
  PlusIcon,
  ShoppingCartIcon,
  TruckIcon,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// Shortcuts to existing create routes. Shipment/Invoice creation starts from
// their source document, so those pages guide the user when opened directly.

const ACTIONS: { label: string; href: string; icon: LucideIcon }[] = [
  {
    label: 'New Sales Order',
    href: '/sale/order/create',
    icon: ShoppingCartIcon,
  },
  {
    label: 'New Shipment',
    href: '/sale/delivery-note/create',
    icon: TruckIcon,
  },
  {
    label: 'New Invoice',
    href: '/finances/invoice/create',
    icon: FileTextIcon,
  },
  {
    label: 'New Inventory Receipt',
    href: '/inventory/receipt/create',
    icon: PackagePlusIcon,
  },
  {
    label: 'New Stock Item',
    href: '/inventory/configurations/stock-item/create',
    icon: PlusIcon,
  },
];

export default function QuickActionsWidget() {
  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
        Quick Actions
      </h3>
      <div className="flex flex-col gap-2">
        {ACTIONS.map(({ label, href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="inline-flex items-center gap-2.5 rounded-xl border border-slate-100 px-3 py-2.5 font-mono text-xs text-slate-600 transition-colors hover:border-emerald-200 hover:bg-emerald-50/50 hover:text-emerald-700"
          >
            <Icon size={14} className="shrink-0 text-[#1a9e52]" />
            {label}
          </Link>
        ))}
      </div>
    </section>
  );
}
