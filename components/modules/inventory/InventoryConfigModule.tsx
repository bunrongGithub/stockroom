'use client';

import { useRegisterModule } from '@/hook/useModule';
import type { ModuleProps } from '@/lib/registry';
import { Award, Ruler, Settings, Tag } from 'lucide-react';
import Link from 'next/link';

export default function InventoryConfigModule({
    currentPath,
    permission,
    currentPathActions,
}: ModuleProps) {
    useRegisterModule({
        actionModules: currentPathActions,
        permission,
        modulePath: currentPath.path,
    });
    const sections = [
        {
            href: '/inventory/configurations/category',
            icon: Tag,
            label: 'Category',
        },
        {
            href: '/inventory/configurations/uom',
            icon: Ruler,
            label: 'Unit of Measure',
        },
        {
            href: '/inventory/configurations/brand',
            icon: Award,
            label: 'Brand',
        },
    ];

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center gap-2">
                <Settings size={20} className="text-emerald-500" />
                <h1 className="text-lg font-bold text-gray-900">
                    Inventory Configuration
                </h1>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {sections.map((s) => {
                    const Icon = s.icon;
                    return (
                        <Link
                            key={s.href}
                            href={s.href}
                            className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-100 hover:border-emerald-200 hover:shadow-sm transition-all group"
                        >
                            <div className="p-2 rounded-lg bg-emerald-50 group-hover:bg-emerald-100 transition-colors">
                                <Icon size={18} className="text-emerald-600" />
                            </div>
                            <span className="text-sm font-medium text-gray-700 group-hover:text-emerald-700">
                                {s.label}
                            </span>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
