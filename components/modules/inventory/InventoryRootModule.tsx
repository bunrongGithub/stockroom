'use client';

import type { ModuleProps } from '@/lib/registry';
import {
    ArrowLeftRight,
    Box,
    Package,
    Settings,
    Warehouse,
} from 'lucide-react';
import Link from 'next/link';

export default function InventoryRootModule({ permission }: ModuleProps) {
    const cards = [
        { href: '/inventory', icon: Package, label: 'Items', show: true },
        {
            href: '/inventory/branch',
            icon: Warehouse,
            label: 'Branch',
            show: true,
        },
        {
            href: '/inventory/stock_adjust',
            icon: ArrowLeftRight,
            label: 'Stock Adjust',
            show: true,
        },
        {
            href: '/inventory/configurations',
            icon: Settings,
            label: 'Configuration',
            show: true,
        },
    ];

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center gap-3">
                <Box size={28} className="text-emerald-500" />
                <div>
                    <h1 className="text-xl font-bold text-gray-900">
                        Inventory
                    </h1>
                    <p className="text-sm text-gray-500">
                        Manage your stock, branches and product catalog
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {cards.map((card) => {
                    const Icon = card.icon;
                    return (
                        <Link
                            key={card.href}
                            href={card.href}
                            className="flex flex-col items-center gap-3 p-6 bg-white rounded-2xl border border-gray-100 shadow-xs hover:border-emerald-200 hover:shadow-md transition-all group"
                        >
                            <div className="p-3 rounded-xl bg-emerald-50 group-hover:bg-emerald-100 transition-colors">
                                <Icon size={22} className="text-emerald-600" />
                            </div>
                            <span className="text-sm font-medium text-gray-700 group-hover:text-emerald-700">
                                {card.label}
                            </span>
                        </Link>
                    );
                })}
            </div>

            {permission.can_create && (
                <div className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2 inline-flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    You have create access in this module
                </div>
            )}
        </div>
    );
}
