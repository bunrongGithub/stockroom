import StockUpdateForm, {
    StockUpdateItemData,
} from '@/components/forms/inventory/stock/StockUpdateForm';
import { serverFetch } from '@/lib/server-fetch';
import { notFound } from 'next/navigation';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function StockUpdatePage({ params }: PageProps) {
    const { id } = await params;

    const API_URL = `${process.env.NEXT_PUBLIC_APP_URL}/api/inventory/${id}`;
    const res = await serverFetch(API_URL, { cache: 'no-store' });
    if (!res.ok) notFound();

    const json = await res.json();
    const raw = json.data;

    const item: StockUpdateItemData = {
        id: raw.id,
        name: raw.name,
        item_class: raw.item_class,
        reference_no: raw.reference_no,
        purchase_price: raw.purchase_price,
        sale_price: raw.sale_price,
        stock: raw.stock ?? null,
        category_id: raw.category_id ?? null,
        uom_id: raw.uom_id ?? null,
        images_url: raw.images_url ?? null,
        description: raw.description ?? null,
        category: Array.isArray(raw.category)
            ? (raw.category[0] ?? null)
            : (raw.category ?? null),
        uom: Array.isArray(raw.uom) ? (raw.uom[0] ?? null) : (raw.uom ?? null),
    };

    return <StockUpdateForm item={item} />;
}
