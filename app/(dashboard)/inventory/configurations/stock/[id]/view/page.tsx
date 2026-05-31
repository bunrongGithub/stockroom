import StockViewDetail from '@/components/forms/inventory/stock/StockViewDetail';
import { BASE_URL } from '@/lib/constant';
import { serverFetch } from '@/lib/server-fetch';
import { notFound } from 'next/navigation';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function StockViewPage({ params }: PageProps) {
    const { id } = await params;

    const res = await serverFetch(`${BASE_URL}/api/inventory/${id}`);
    if (!res.ok) notFound();

    const json = await res.json();
    const item = json.data;
    if (!item) notFound();

    return <StockViewDetail item={item} />;
}
