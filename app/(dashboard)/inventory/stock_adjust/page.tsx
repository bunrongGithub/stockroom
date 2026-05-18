import { InventoryItemProps } from '@/types/inventory/item';
import { notFound } from 'next/navigation';
import StockAdjustPageClient from './StockAdjustPageClient';

export default async function StockAdjustPage() {
    const res = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL}/api/inventory`,
        { cache: 'no-store' },
    );
    if (!res.ok) notFound();

    const json = await res.json();
    const items: InventoryItemProps[] = json.data ?? [];

    // Only stock-class items can have their stock adjusted
    const stockItems = items.filter((i) => i.item_class === 'stock');

    return <StockAdjustPageClient items={stockItems} />;
}