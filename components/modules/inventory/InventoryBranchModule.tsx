'use client';

import type { ModuleProps } from '@/lib/module-registry';
import { Warehouse } from 'lucide-react';

// This module is rendered by the catch-all when /inventory/branch has no specific page override.
// In dev the specific page at app/(dashboard)/inventory/branch/page.tsx takes priority.
export default function InventoryBranchModule({ permission }: ModuleProps) {
    return (
        <div className="p-6 space-y-4">
            <div className="flex items-center gap-2">
                <Warehouse size={20} className="text-emerald-500" />
                <h1 className="text-lg font-bold text-gray-900">Branch / Warehouse</h1>
            </div>
            {!permission.can_view && (
                <p className="text-sm text-red-500">You do not have permission to view this module.</p>
            )}
        </div>
    );
}
