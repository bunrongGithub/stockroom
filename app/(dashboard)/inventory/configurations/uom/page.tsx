import UomListForm from '@/components/forms/inventory/uom/UomListForm';
import { notFound } from 'next/navigation';

async function page() {
    const API_URL = `${process.env.NEXT_PUBLIC_APP_URL}/api/uom`;
    const res = await fetch(API_URL);
    if (!res.ok) notFound();
    const json = await res.json();
    const uomLIst = json.data;

    return <UomListForm uoms={uomLIst.data} />;
}

export default page;
