'use client';

import { useModuleActions } from '@/hook/usePageAction';
import type { ModuleProps } from '@/lib/registry';
import { Ruler } from 'lucide-react';

export default function InventoryUomModule({
    module,
    permission,
    actionModules,
}: ModuleProps) {
    useModuleActions({ actionModules, permission, modulePath: module.path });

    return (
        <div className="p-6 space-y-4">
            <div className="flex items-center gap-2">
                <Ruler size={20} className="text-emerald-500" />
                <h1 className="text-lg font-bold text-gray-900">
                    Unit of Measure
                </h1>
            </div>
            <p className="text-sm text-gray-500">
                Manage units of measure for inventory items.
            </p>
        </div>
    );
}

