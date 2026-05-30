import UomListForm from '@/components/forms/inventory/uom/UomListForm';
import { serverFetch } from '@/lib/server-fetch';
import { notFound } from 'next/navigation';

interface PageProps {
    searchParams: Promise<{ page?: string; limit?: string; search?: string }>;
}

async function page({ searchParams }: PageProps) {
    const { page = '1', limit = '10', search = '' } = await searchParams;

    const params = new URLSearchParams({ page, limit, search });
    const API_URL = `${process.env.NEXT_PUBLIC_APP_URL}/api/uom?${params}`;

    const res = await serverFetch(API_URL, { cache: 'no-store' });
    console.log(res);

    if (!res.ok) notFound();

    const json = await res.json();
    const listPagination = json.data;
    return <UomListForm uoms={listPagination.data} meta={listPagination.meta} />;
}

export default page;
