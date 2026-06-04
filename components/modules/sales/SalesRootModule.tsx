'use client';

import type { ModuleProps } from '@/lib/module-registry';
import { BadgePercent } from 'lucide-react';

export default function SalesRootModule({ permission }: ModuleProps) {
    return (
        <div className="p-6 space-y-4">
            <div className="flex items-center gap-2">
                <BadgePercent size={20} className="text-emerald-500" />
                <h1 className="text-lg font-bold text-gray-900">Sales</h1>
            </div>
            <p className="text-sm text-gray-500">Sales module — coming soon.</p>
            {permission.can_create && (
                <div className="text-xs text-gray-400">You have create access.</div>
            )}
        </div>
    );
}

