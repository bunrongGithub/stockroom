'use client';

import { useRegisterModule } from '@/hook/useModule';
import type { ModuleProps } from '@/lib/registry';
import { stockCountApi } from '@/lib/api/stock-count';
import type { StockCount } from '@/types/inventory/stock-count';
import CountForm from '../CountForm';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FileWarning, Loader2Icon } from 'lucide-react';

// Registered as `InventoryStockCountUpdate` — edit a DRAFT count.
export default function InventoryStockCountUpdate({
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

    const [count, setCount] = useState<StockCount | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!id) return;
        (async () => {
            try {
                setCount(await stockCountApi.get(id));
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Failed to load stock count');
            } finally {
                setLoading(false);
            }
        })();
    }, [id]);

    if (loading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loader2Icon className="animate-spin text-success" size={26} />
            </div>
        );
    }

    if (error || !count) {
        return (
            <div className="flex h-64 flex-col items-center justify-center gap-3">
                <FileWarning className="text-muted-foreground" size={40} />
                <p className="text-sm text-muted-foreground">
                    {error || 'Stock count not found.'}
                </p>
                <button
                    onClick={() => router.push('/inventory/stock_count')}
                    className="text-xs text-info hover:underline"
                >
                    Back to list
                </button>
            </div>
        );
    }

    if (count.status !== 'DRAFT') {
        return (
            <div className="flex h-64 flex-col items-center justify-center gap-3">
                <FileWarning className="text-warning" size={40} />
                <p className="text-sm text-muted-foreground">
                    Only DRAFT counts can be edited. {count.count_no} is {count.status}.
                </p>
                <button
                    onClick={() => router.push(`/inventory/stock_count/${count.id}/view`)}
                    className="text-xs text-info hover:underline"
                >
                    View stock count
                </button>
            </div>
        );
    }

    return <CountForm mode="edit" initial={count} />;
}
