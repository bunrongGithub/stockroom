'use client';

import { useRegisterModule } from '@/hook/useModule';
import type { ModuleProps } from '@/lib/registry';
import ShipmentForm from '../ShipmentForm';
import { saleOrderApi, saleShipmentApi } from '@/lib/api/sale';
import type { SalesOrder, SalesShipment } from '@/types/sales/order-management';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2Icon, PackageIcon } from 'lucide-react';

export default function SaleShipmentUpdate({
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
    const [shipment, setShipment] = useState<SalesShipment | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!id) return;
        (async () => {
            try {
                const s = await saleShipmentApi.get(id);
                setShipment(s);
                setOrder(await saleOrderApi.get(s.sales_order_id));
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Failed to load shipment');
            } finally {
                setLoading(false);
            }
        })();
    }, [id]);

    if (loading) {
        return <div className="flex items-center justify-center h-64"><Loader2Icon className="animate-spin text-emerald-500" size={26} /></div>;
    }

    if (error || !shipment || !order) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
                <PackageIcon className="text-muted-foreground" size={40} />
                <p className="text-sm text-muted-foreground">{error || 'Shipment not found.'}</p>
                <button onClick={() => router.push('/sale/delivery-note')} className="text-xs text-sky-600 hover:underline">Back to list</button>
            </div>
        );
    }

    if (!shipment.actions?.can_update) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
                <PackageIcon className="text-muted-foreground" size={40} />
                <p className="text-sm text-muted-foreground">Shipment {shipment.shipment_no} can no longer be edited (status: {shipment.status}).</p>
                <button onClick={() => router.push(`/sale/delivery-note/${shipment.id}/view`)} className="text-xs text-sky-600 hover:underline">View shipment</button>
            </div>
        );
    }

    return <ShipmentForm mode="edit" order={order} initial={shipment} />;
}
