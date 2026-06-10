import NoneStockForm from '@/components/forms/inventory/none_stock/NoneStockForm';
import { serverFetch } from '@/lib/fetch';
import { notFound } from 'next/navigation';

const BASE = process.env.NEXT_PUBLIC_APP_URL;

export default async function NoneStockPage() {
    const [inventoryRes, servicesRes] = await Promise.all([
        serverFetch(`${BASE}/api/inventory?limit=1000`, { cache: 'no-store' }),
        serverFetch(`${BASE}/api/repair-service`, { cache: 'no-store' }),
    ]);

    if (!inventoryRes.ok && !servicesRes.ok) notFound();

    const inventoryJson = inventoryRes.ok
        ? await inventoryRes.json()
        : { data: { data: [] } };
    const servicesJson = servicesRes.ok
        ? await servicesRes.json()
        : { data: [] };

    return (
        <NoneStockForm
            items={inventoryJson.data?.data ?? inventoryJson.data ?? []}
            services={servicesJson.data ?? []}
        />
    );
}
