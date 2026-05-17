import ProductDashboard from '@/components/forms/inventory/ProductDashboard';
import { notFound } from 'next/navigation';

interface PageProps {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ create_success?: string; stock?: string }>;
}

async function page({ params, searchParams }: PageProps) {
    const { id } = await params;
    const { create_success, stock } = await searchParams; // 👈 await it

    const isNewStock = create_success === 'true' && stock === 'true';

    const API_URL = `${process.env.NEXT_PUBLIC_APP_URL}/api/inventory/${id}`;
    const res = await fetch(API_URL);
    if (!res.ok) notFound();

    const json = await res.json();
    const item = json.data;

    return (
        <div>
            <ProductDashboard item={item} autoOpenStockModal={isNewStock} />
        </div>
    );
}

export default page;
