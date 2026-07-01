'use client';

import { useRegisterModule } from '@/hook/useModule';
import type { ModuleProps } from '@/lib/registry';
import ShipmentForm from '../ShipmentForm';
import { saleOrderApi } from '@/lib/api/sale';
import type { SalesOrder } from '@/types/sales/order-management';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2Icon, PackageIcon } from 'lucide-react';

// Registered as `SaleDeliveryNoteCreate` — the new-shipment form.
export default function SaleShipmentCreate({
    currentPath,
    permission,
    currentPathActions,
}: ModuleProps) {
    useRegisterModule({
        actionModules: currentPathActions,
        permission,
        modulePath: currentPath.path,
    });

    const router = useRouter();
    const [order, setOrder] = useState<SalesOrder | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const orderId =
            typeof window !== 'undefined'
                ? sessionStorage.getItem('pending_dn_order_id')
                : null;
        if (!orderId) {
            setError('No order selected. Start a shipment from a sales order.');
            setLoading(false);
            return;
        }
        (async () => {
            try {
                setOrder(await saleOrderApi.get(orderId));
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Failed to load order');
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    if (loading) {
        return <div className="flex items-center justify-center h-64"><Loader2Icon className="animate-spin text-emerald-500" size={26} /></div>;
    }

    if (error || !order) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
                <PackageIcon className="text-muted-foreground" size={40} />
                <p className="text-sm text-muted-foreground">{error || 'Order not found.'}</p>
                <button onClick={() => router.push('/sale/order')} className="text-xs text-sky-600 hover:underline">Go to orders</button>
            </div>
        );
    }

    if (!order.actions?.can_ship) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
                <PackageIcon className="text-muted-foreground" size={40} />
                <p className="text-sm text-muted-foreground">Order {order.order_no} cannot be shipped (status: {order.status}).</p>
                <button onClick={() => router.push(`/sale/order/${order.id}/view`)} className="text-xs text-sky-600 hover:underline">View order</button>
            </div>
        );
    }

    return <ShipmentForm mode="create" order={order} />;
}
