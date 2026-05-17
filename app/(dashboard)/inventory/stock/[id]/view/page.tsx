import ProductDashboard from '@/components/forms/inventory/ProductDashboard';
import { notFound } from 'next/navigation';

async function page({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const API_URL = `${process.env.NEXT_PUBLIC_APP_URL}/api/inventory/${id}`;
    const res = await fetch(API_URL);
    if (!res.ok) notFound();

    const json = await res.json();
    const item = json.data;

    console.log(item)
    return (
        <div>
            <ProductDashboard item={item} />
        </div>
    );
}

export default page;
