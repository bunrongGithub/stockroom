'use client';

import { useRegisterModule } from '@/hook/useModule';
import type { ModuleProps } from '@/lib/registry';
import { stockAdjustmentApi } from '@/lib/api/adjustment';
import type { StockAdjustment } from '@/types/inventory/adjustment';
import AdjustmentForm from '../AdjustmentForm';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FileWarning, Loader2Icon } from 'lucide-react';

// Registered as `InventoryStockAdjUpdate` — edit a DRAFT adjustment.
export default function InventoryStockAdjUpdate({
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
    const router = useRouter();
    const id = Number(Array.isArray(params.slug) ? params.slug.at(-2) : '');

    const [adjustment, setAdjustment] = useState<StockAdjustment | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!id) return;
        (async () => {
            try {
                setAdjustment(await stockAdjustmentApi.get(id));
            } catch (e) {
                setError(
                    e instanceof Error ? e.message : 'Failed to load adjustment',
                );
            } finally {
                setLoading(false);
            }
        })();
    }, [id]);

    if (loading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loader2Icon className="animate-spin text-emerald-500" size={26} />
            </div>
        );
    }

    if (error || !adjustment) {
        return (
            <div className="flex h-64 flex-col items-center justify-center gap-3">
                <FileWarning className="text-muted-foreground" size={40} />
                <p className="text-sm text-muted-foreground">
                    {error || 'Adjustment not found.'}
                </p>
                <button
                    onClick={() => router.push('/inventory/stock_adjust')}
                    className="text-xs text-sky-600 hover:underline"
                >
                    Back to list
                </button>
            </div>
        );
    }

    if (adjustment.status !== 'DRAFT') {
        return (
            <div className="flex h-64 flex-col items-center justify-center gap-3">
                <FileWarning className="text-amber-500" size={40} />
                <p className="text-sm text-muted-foreground">
                    Only DRAFT adjustments can be edited.{' '}
                    {adjustment.adjustment_no} is {adjustment.status}.
                </p>
                <button
                    onClick={() =>
                        router.push(`/inventory/stock_adjust/${adjustment.id}/view`)
                    }
                    className="text-xs text-sky-600 hover:underline"
                >
                    View adjustment
                </button>
            </div>
        );
    }

    return <AdjustmentForm mode="edit" initial={adjustment} />;
}
