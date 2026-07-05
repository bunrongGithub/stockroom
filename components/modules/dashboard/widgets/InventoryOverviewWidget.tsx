'use client';

import Link from 'next/link';
import { TriangleAlertIcon } from 'lucide-react';
import type {
    DashboardInventory,
    DashboardLowStockImpact,
} from '@/types/dashboard';

// Inventory overview stat grid. Amber/rose are STATUS colors (low / out of
// stock) and always ship with their label — never color alone.

function money(n: number) {
    return n.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

const ITEM_LIST = '/inventory/configurations/stock-item';

export default function InventoryOverviewWidget({
    inventory,
    impact,
    warehouseName,
}: {
    inventory: DashboardInventory;
    /** How many open sales documents touch low/out-of-stock items. */
    impact: DashboardLowStockImpact;
    warehouseName: string;
}) {
    const stats: {
        label: string;
        value: string;
        href: string;
        valueClass?: string;
    }[] = [
        {
            label: 'Stock Items',
            value: String(inventory.total_stock_items),
            href: ITEM_LIST,
        },
        {
            label: 'On-hand Quantity',
            value: inventory.total_qty.toLocaleString('en-US'),
            href: ITEM_LIST,
        },
        {
            label: 'Inventory Value',
            value: `$ ${money(inventory.total_value)}`,
            href: ITEM_LIST,
        },
        {
            label: 'Serial-controlled',
            value: String(inventory.serial_items),
            href: ITEM_LIST,
        },
        {
            label: 'Low Stock',
            value: String(inventory.low_stock),
            href: ITEM_LIST,
            valueClass:
                inventory.low_stock > 0 ? 'text-amber-600' : undefined,
        },
        {
            label: 'Out of Stock',
            value: String(inventory.out_of_stock),
            href: ITEM_LIST,
            valueClass:
                inventory.out_of_stock > 0 ? 'text-rose-600' : undefined,
        },
    ];

    return (
        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-baseline justify-between gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Inventory Overview
                </h3>
                <span className="truncate font-mono text-[10px] text-slate-400">
                    {warehouseName}
                </span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {stats.map((s) => (
                    <Link
                        key={s.label}
                        href={s.href}
                        className="rounded-xl border border-slate-100 px-3 py-2.5 transition-colors hover:border-slate-200 hover:bg-slate-50/60"
                    >
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            {s.label}
                        </span>
                        <span
                            className={`block font-mono text-lg font-bold tabular-nums ${s.valueClass ?? 'text-slate-800'}`}
                        >
                            {s.value}
                        </span>
                    </Link>
                ))}
            </div>

            {/* Low-stock sales impact: is short stock blocking open sales? */}
            {(impact.affected_orders > 0 || impact.affected_shipments > 0) && (
                <p className="mt-3 flex items-center gap-2 rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-2 font-mono text-[11px] text-amber-700">
                    <TriangleAlertIcon size={13} className="shrink-0" />
                    Low stock affects {impact.affected_orders} open order
                    {impact.affected_orders === 1 ? '' : 's'} ·{' '}
                    {impact.affected_shipments} draft shipment
                    {impact.affected_shipments === 1 ? '' : 's'}
                </p>
            )}
        </section>
    );
}
