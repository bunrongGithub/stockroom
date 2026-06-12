'use client';

import StockForm from '@/components/forms/inventory/stock/StockForm';
import { useRegisterModule } from '@/hook/useModule';
import type { ModuleProps } from '@/lib/registry';
import { InventoryItemProps } from '@/types/inventory/item';

export default function InventoryItemsModule({
    module,
    permission,
    actionModules,
    initialData,
    initialMeta,
}: ModuleProps) {
    useRegisterModule({ actionModules, permission, modulePath: module.path });
    return <StockForm items={initialData as Array<InventoryItemProps>} />;
}
