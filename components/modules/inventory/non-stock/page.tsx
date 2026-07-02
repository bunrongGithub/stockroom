'use client';

import NonStockItemListForm from '@/components/forms/inventory/non-stock/NonStockItemListForm';
import { useRegisterModule } from '@/hook/useModule';
import type { ModuleProps } from '@/lib/registry';
import type { InventoryItem } from '@/service/apps/inventory/repo/stock';

export default function InventoryNonStockModule({
    currentPath,
    permission,
    currentPathActions,
    initialData,
}: ModuleProps) {
    useRegisterModule({
        actionModules: currentPathActions,
        permission,
        modulePath: currentPath.path,
    });
    return (
        <NonStockItemListForm
            items={(initialData as InventoryItem[] | null) ?? []}
        />
    );
}
