import UomFormUpdate from '@/components/forms/inventory/uom/UomFormUpdate';
import { serverFetch } from '@/lib/fetch';
import { notFound } from 'next/navigation';
async function page({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const API_URL = `${process.env.NEXT_PUBLIC_APP_URL}/api/uom/${id}`;
    const res = await serverFetch(API_URL);
    if (!res.ok) notFound();

    const json = await res.json();
    const uom = json.data;
    return (
        <div className="p-4 md:p-8">
            <UomFormUpdate id={Number(id)} defaultValues={uom} />
        </div>
    );
}

export default page;
