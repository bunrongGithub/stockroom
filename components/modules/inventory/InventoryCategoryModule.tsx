'use client';

import CategoryListForm from '@/components/forms/inventory/category/CategoryListForm';
import { usePageActions } from '@/hook/usePageAction';
import type { ModuleProps } from '@/lib/module-registry';
import type { TMeta, TPaginatedResponse } from '@/types/app';
import type { TCategory } from '@/types/inventory/item';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

const DEFAULT_META: TMeta = { total: 0, page: 1, limit: 10, totalPages: 0 };
const BASE_PATH = '/inventory/configurations/category';

function CategoryContent({ permission }: ModuleProps) {
    const searchParams = useSearchParams();
    const page = searchParams.get('page') ?? '1';
    const limit = searchParams.get('limit') ?? '10';
    const search = searchParams.get('search') ?? '';

    const { setActions } = usePageActions();

    const [data, setData] = useState<TPaginatedResponse<TCategory & { id: number }>>({
        data: [],
        meta: DEFAULT_META,
    });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const actions = [];
        if (permission.can_create) {
            actions.push({ label: 'Add Category', href: `${BASE_PATH}/create`, type: 'user_action' as const, dynamic: false, icon: Plus });
        }
        if (permission.can_update) {
            actions.push({ label: 'Edit', href: `${BASE_PATH}/:id/update`, type: 'user_action' as const, dynamic: true, icon: Pencil });
        }
        if (permission.can_delete) {
            actions.push({ label: 'Delete', href: null, type: 'user_action' as const, dynamic: true, icon: Trash2 });
        }
        setActions(actions);
        return () => setActions([]);
    }, [permission, setActions]);

    useEffect(() => {
        setIsLoading(true);
        const params = new URLSearchParams({ page, limit, search });
        fetch(`/api/category?${params}`)
            .then((r) => r.ok ? r.json() : { data: { data: [], meta: DEFAULT_META } })
            .then((json) => setData(json.data ?? { data: [], meta: DEFAULT_META }))
            .catch(() => setData({ data: [], meta: DEFAULT_META }))
            .finally(() => setIsLoading(false));
    }, [page, limit, search]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 size={20} className="animate-spin text-emerald-500" />
            </div>
        );
    }

    return <CategoryListForm categories={data.data} meta={data.meta} />;
}

const loadingFallback = (
    <div className="flex items-center justify-center h-64">
        <Loader2 size={20} className="animate-spin text-emerald-500" />
    </div>
);

export default function InventoryCategoryModule(props: ModuleProps) {
    return (
        <Suspense fallback={loadingFallback}>
            <CategoryContent {...props} />
        </Suspense>
    );
}
