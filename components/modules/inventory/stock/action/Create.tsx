'use client';

import StockCreateForm from '@/components/forms/inventory/stock/StockCreateForm';
import { useRegisterModule } from '@/hook/useModule';
import type { ModuleProps } from '@/lib/registry';

export default function InventoryStockItemCreate({
    currentPath,
    permission,
    currentPathActions,
}: ModuleProps) {
    useRegisterModule({
        actionModules: currentPathActions,
        permission,
        modulePath: currentPath.path,
    });
    return <StockCreateForm />;
}
