import CategoryListForm from '@/components/forms/inventory/category/CategoryListForm';
import { notFound } from 'next/navigation';

interface PageProps {
    searchParams: Promise<{ page?: string; limit?: string; search?: string }>;
}

async function page({ searchParams }: PageProps) {
    const { page = '1', limit = '10', search = '' } = await searchParams;

    const params = new URLSearchParams({ page, limit, search });
    const API_URL = `${process.env.NEXT_PUBLIC_APP_URL}/api/category?${params}`;

    const res = await fetch(API_URL, { cache: 'no-store' });
    if (!res.ok) notFound();

    const json = await res.json();
    const listPagination = json.data;
    return (
        <CategoryListForm
            categories={listPagination.data}
            meta={listPagination.meta}
        />
    );
}

export default page;
