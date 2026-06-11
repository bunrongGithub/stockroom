'use client';

import CategoryListForm from '@/components/forms/inventory/category/CategoryListForm';
import { useModuleActions } from '@/hook/usePageAction';
import type { ModuleProps } from '@/lib/registry';
import type { TMeta } from '@/types/app';
import type { TCategory } from '@/types/inventory/item';

const DEFAULT_META: TMeta = { total: 0, page: 1, limit: 10, totalPages: 0 };

export default function InventoryCategoryModule({
    module,
    permission,
    initialData,
    initialMeta,
    actionModules,
}: ModuleProps) {
    useModuleActions({ actionModules, permission, modulePath: module.path });

    return (
        <CategoryListForm
            categories={
                (initialData as Array<TCategory & { id: number }>) ?? []
            }
            meta={initialMeta ?? DEFAULT_META}
        />
    );
}
