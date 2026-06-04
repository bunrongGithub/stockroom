'use client';

import CategoryListForm from '@/components/forms/inventory/category/CategoryListForm';
import { usePageActions } from '@/hook/usePageAction';
import type { ModuleProps } from '@/lib/module-registry';
import type { TMeta } from '@/types/app';
import type { TCategory } from '@/types/inventory/item';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect } from 'react';

const DEFAULT_META: TMeta = { total: 0, page: 1, limit: 10, totalPages: 0 };

export default function InventoryCategoryModule({ module, permission, initialData, initialMeta }: ModuleProps) {
    const { setActions , actions} = usePageActions();
    console.log('InventoryCategoryModule rendered with actions:', actions);
    useEffect(() => {
        const actions = [];
        if (permission.can_create) {
            actions.push({ label: 'Add Category', href: `${module.path}/create`, type: 'user_action' as const, dynamic: false, icon: Plus });
        }
        if (permission.can_update) {
            actions.push({ label: 'Edit', href: `${module.path}/:id/update`, type: 'user_action' as const, dynamic: true, icon: Pencil });
        }
        if (permission.can_delete) {
            actions.push({ label: 'Delete', href: null, type: 'user_action' as const, dynamic: true, icon: Trash2 });
        }
        setActions(actions);
        return () => setActions([]);
    }, [module.path, permission, setActions]);

    const categories = ((initialData as unknown as Array<TCategory & { id: number }>) ?? []);
    const meta = initialMeta ?? DEFAULT_META;

    return <CategoryListForm categories={categories} meta={meta} initialData={initialData as unknown as Array<TCategory & { id: number }>} initialMeta={initialMeta} />;
}
