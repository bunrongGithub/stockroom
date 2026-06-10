import StockEditForm from '@/components/forms/inventory/stock/StockEditForm';
import { BASE_URL } from '@/lib/constant';
import { serverFetch } from '@/lib/fetch';
import { notFound } from 'next/navigation';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function StockEditPage({ params }: PageProps) {
    const { id } = await params;

    const res = await serverFetch(`${BASE_URL}/api/inventory/${id}`);
    if (!res.ok) notFound();

    const json = await res.json();
    const item = json.data;
    if (!item) notFound();

    return <StockEditForm item={item} />;
}
