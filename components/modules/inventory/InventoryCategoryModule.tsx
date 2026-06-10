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

    const categories =
        (initialData as unknown as Array<TCategory & { id: number }>) ?? [];
    const meta = initialMeta ?? DEFAULT_META;

    return (
        <CategoryListForm
            categories={categories}
            meta={meta}
            initialData={
                initialData as unknown as Array<TCategory & { id: number }>
            }
            initialMeta={initialMeta}
        />
    );
}
