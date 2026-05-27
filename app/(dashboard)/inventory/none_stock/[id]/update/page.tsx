import NoneStockUpdateForm, {
    NoneStockUpdateItemData,
} from '@/components/forms/inventory/none_stock/NoneStockUpdateForm';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function NoneStockUpdatePage({ params }: PageProps) {
    const { id } = await params;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    const API_URL = `${process.env.NEXT_PUBLIC_APP_URL}/api/inventory/${id}`;
    const res = await fetch(API_URL, { cache: 'no-store' });
    if (!res.ok) notFound();

    const json = await res.json();
    const raw = json.data;

    const item: NoneStockUpdateItemData = {
        id: raw.id,
        name: raw.name,
        item_class: raw.item_class,
        reference_no: raw.reference_no,
        labor_cost: raw.labor_cost ?? raw.purchase_price ?? 0,
        sale_price: raw.sale_price,
        warranty_duration: raw.warranty_duration ?? null,
        estimated_duration: raw.estimated_duration ?? null,
        category_id: raw.category_id ?? null,
        uom_id: raw.uom_id ?? null,
        images_url: raw.images_url ?? null,
        description: raw.description ?? null,
        category: Array.isArray(raw.category) ? (raw.category[0] ?? null) : (raw.category ?? null),
        uom: Array.isArray(raw.uom) ? (raw.uom[0] ?? null) : (raw.uom ?? null),
    };

    return <NoneStockUpdateForm item={item} />;
}
