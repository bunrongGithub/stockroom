'use client';

import StockForm from '@/components/forms/inventory/stock/StockForm';
import { useModuleActions } from '@/hook/usePageAction';
import type { ModuleProps } from '@/lib/registry';
import { InventoryItemProps } from '@/types/inventory/item';

export default function InventoryItemsModule({
    module,
    permission,
    actionModules,
    initialData,
    initialMeta,
}: ModuleProps) {
    useModuleActions({ actionModules, permission, modulePath: module.path });
    return <StockForm items={initialData as Array<InventoryItemProps>} />;
}
