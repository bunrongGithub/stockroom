import CategoryUpdateForm from '@/components/forms/inventory/category/CategoryUpdateForm';
import { serverFetch } from '@/lib/server-fetch';
import { notFound } from 'next/navigation';

async function page({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const API_URL = `${process.env.NEXT_PUBLIC_APP_URL}/api/category/${id}`;
    const res = await serverFetch(API_URL);
    if (!res.ok) notFound();

    const json = await res.json();
    const category = json.data;

    return (
        <div className="p-4 md:p-8">
            <CategoryUpdateForm id={category.id} defaultValues={category} />
        </div>
    );
}

export default page;
