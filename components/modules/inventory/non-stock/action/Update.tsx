'use client';

import NonStockItemEditForm, { type NonStockEditItem } from '@/components/forms/inventory/non-stock/NonStockItemEditForm';
import { useRegisterModule } from '@/hook/useModule';
import type { ModuleProps } from '@/lib/registry';
import { Loader2 } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function InventoryNonStockUpdate({
    currentPath,
    permission,
    currentPathActions,
}: ModuleProps) {
    useRegisterModule({
        actionModules: currentPathActions,
        permission,
        modulePath: currentPath.path,
    });

    const params = useParams();
    const id = Number(
        Array.isArray(params.slug) ? params.slug.at(-2) : params.slug,
    );

    const [item, setItem] = useState<NonStockEditItem | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!id) return;
        setLoading(true);
        fetch(`/api/inventory/configurations/non-stock-item/${id}`)
            .then((r) => r.json())
            .then((json) => {
                if (json.data) setItem(json.data);
                else setError(json.error ?? 'Item not found');
            })
            .catch(() => setError('Failed to load item'))
            .finally(() => setLoading(false));
    }, [id]);

    if (loading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loader2 className="animate-spin text-emerald-500" size={28} />
            </div>
        );
    }

    if (error || !item) {
        return (
            <div className="flex h-64 items-center justify-center text-sm text-red-500">
                {error || 'Item not found'}
            </div>
        );
    }

    return <NonStockItemEditForm item={item} />;
}
