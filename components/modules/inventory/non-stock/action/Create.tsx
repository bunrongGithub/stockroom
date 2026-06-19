'use client';

import NonStockItemCreateForm from '@/components/forms/inventory/non-stock/NonStockItemCreateForm';
import { useRegisterModule } from '@/hook/useModule';
import type { ModuleProps } from '@/lib/registry';

export default function InventoryNonStockCreate({
    currentPath,
    permission,
    currentPathActions,
}: ModuleProps) {
    useRegisterModule({
        actionModules: currentPathActions,
        permission,
        modulePath: currentPath.path,
    });
    return <NonStockItemCreateForm />;
}
