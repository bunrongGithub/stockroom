import NoneStockForm from '@/components/forms/inventory/none_stock/NoneStockForm';
import { createClient } from '@/lib/supabase/server';
import { InventoryItemProps } from '@/types/inventory/item';
import { notFound, redirect } from 'next/navigation';

export default async function NoneStockPage() {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    // 1. Fetch inventory items
    const API_URL = `${process.env.NEXT_PUBLIC_APP_URL}/api/inventory`;
    const res = await fetch(API_URL, { cache: 'no-store' });
    if (!res.ok) notFound();
    const json = await res.json();
    const items = (json.data ?? []) as InventoryItemProps[];

    // 2. Filter only non-stock and service items
    const serviceItems = items.filter(
        (item) => item.item_class === 'non_stock' || item.item_class === 'service'
    );

    return <NoneStockForm inv_items={serviceItems} />;
}
