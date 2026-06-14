'use client';

import { useRegisterModule } from '@/hook/useModule';
import type { ModuleProps } from '@/lib/registry';
import { Award } from 'lucide-react';

export default function InventoryBrandModule({
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
                <Award size={20} className="text-emerald-500" />
                <h1 className="text-lg font-bold text-gray-900">Brand</h1>
            </div>
            <p className="text-sm text-gray-500">
                Manage brands for inventory items.
            </p>
        </div>
    );
}
