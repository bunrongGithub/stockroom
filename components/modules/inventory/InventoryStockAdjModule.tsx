'use client';

import { useRegisterModule } from '@/hook/useModule';
import type { ModuleProps } from '@/lib/registry';
import { ArrowLeftRight } from 'lucide-react';

export default function InventoryStockAdjModule({
    currentPath,
    permission,
    currentPathActions,
}: ModuleProps) {
    useRegisterModule({
        actionModules: currentPathActions,
        permission,
        modulePath: currentPath.path,
    });
    return (
        <div className="p-6 space-y-4">
            <div className="flex items-center gap-2">
                <ArrowLeftRight size={20} className="text-emerald-500" />
                <h1 className="text-lg font-bold text-gray-900">
                    Stock Adjustment
                </h1>
            </div>
            {!permission.can_view && (
                <p className="text-sm text-red-500">
                    You do not have permission to view this module.
                </p>
            )}
        </div>
    );
}
