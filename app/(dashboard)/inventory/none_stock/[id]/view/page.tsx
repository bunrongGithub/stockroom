import ProductDashboard from '@/components/forms/inventory/ProductDashboard';
import { notFound } from 'next/navigation';

interface PageProps {
    params: Promise<{ id: string }>;
}

async function page({ params }: PageProps) {
    const { id } = await params;

    const API_URL = `${process.env.NEXT_PUBLIC_APP_URL}/api/inventory/${id}`;
    const res = await fetch(API_URL, { cache: 'no-store' });
    if (!res.ok) notFound();

    const json = await res.json();
    const item = json.data;

    return (
        <div>
            <ProductDashboard item={item} />
        </div>
    );
}

export default page;
