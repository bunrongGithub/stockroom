'use client';

import { useRegisterModule } from '@/hook/useModule';
import type { ModuleProps } from '@/lib/registry';
import AdjustmentForm from '../AdjustmentForm';

// Registered as `InventoryStockAdjCreate`.
export default function InventoryStockAdjCreate({
    currentPath,
    permission,
    currentPathActions,
}: ModuleProps) {
    useRegisterModule({
        actionModules: currentPathActions,
        permission,
        modulePath: currentPath.path,
    });

    return <AdjustmentForm mode="create" />;
}
