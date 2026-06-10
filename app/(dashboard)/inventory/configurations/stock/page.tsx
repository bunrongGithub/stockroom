import StockForm from '@/components/forms/inventory/stock/StockForm';
import { getSession } from '@/lib/auth';
import { serverFetch } from '@/lib/fetch';
import { notFound, redirect } from 'next/navigation';

async function page() {
    const session = await getSession();
    if (!session) redirect('/signin');

    const API_URL = `${process.env.NEXT_PUBLIC_APP_URL}/api/inventory`;
    const res = await serverFetch(API_URL, { cache: 'no-store' });
    if (!res.ok) notFound();
    const json = await res.json();
    const items = json.data?.data ?? json.data ?? [];
    return <StockForm items={items} />;
}

export default page;
