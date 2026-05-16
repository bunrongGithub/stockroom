import StockForm from '@/components/forms/inventory/stock/StockForm';
import { notFound } from 'next/navigation';

async function page() {
    const API_URL = `${process.env.NEXT_PUBLIC_APP_URL}/api/inventory`;

    const res = await fetch(API_URL);
    if (!res.ok) notFound();
    const json = await res.json();
    const items = json.data;
    console.log(items)
    return <StockForm inv_items={items} />;
}

export default page;
