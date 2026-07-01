'use client';

import { useRegisterModule } from '@/hook/useModule';
import type { ModuleProps } from '@/lib/registry';
import OrderForm from '../OrderForm';
import { saleOrderApi } from '@/lib/api/sale';
import type { SalesOrder } from '@/types/sales/order-management';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Loader2Icon, PackageIcon } from 'lucide-react';

export default function SaleOrderUpdate({
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
    const id = Array.isArray(params.slug) ? (params.slug.at(-2) ?? '') : '';

    const [order, setOrder] = useState<SalesOrder | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!id) return;
        (async () => {
            try {
                setOrder(await saleOrderApi.get(id));
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Failed to load order');
            } finally {
                setLoading(false);
            }
        })();
    }, [id]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2Icon className="animate-spin text-emerald-500" size={26} />
            </div>
        );
    }

    if (error || !order) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
                <PackageIcon className="text-muted-foreground" size={40} />
                <p className="text-sm text-muted-foreground">{error || 'Sales order not found.'}</p>
                <button onClick={() => router.push('/sale/order')} className="text-xs text-sky-600 hover:underline">
                    Back to list
                </button>
            </div>
        );
    }

    if (!order.actions?.can_update) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
                <PackageIcon className="text-muted-foreground" size={40} />
                <p className="text-sm text-muted-foreground">
                    Order {order.order_no} can no longer be edited (status: {order.status}).
                </p>
                <button onClick={() => router.push(`/sale/order/${order.id}/view`)} className="text-xs text-sky-600 hover:underline">
                    View order
                </button>
            </div>
        );
    }

    return <OrderForm mode="edit" initial={order} />;
}
