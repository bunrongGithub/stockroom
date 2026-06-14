'use client';

import CategoryListForm from '@/components/forms/inventory/category/CategoryListForm';
import { useRegisterModule } from '@/hook/useModule';
import type { ModuleProps } from '@/lib/registry';
import type { TMeta } from '@/types/app';
import type { TCategory } from '@/types/inventory/item';

const DEFAULT_META: TMeta = { total: 0, page: 1, limit: 10, totalPages: 0 };

export default function InventoryCategoryModule({
    currentPath,
    permission,
    initialData,
    initialMeta,
    currentPathActions,
}: ModuleProps) {
    useRegisterModule({
        actionModules: currentPathActions,
        permission,
        modulePath: currentPath.path,
    });

    return (
        <CategoryListForm
            categories={
                (initialData as Array<TCategory & { id: number }>) ?? []
            }
            meta={initialMeta ?? DEFAULT_META}
        />
    );
}
