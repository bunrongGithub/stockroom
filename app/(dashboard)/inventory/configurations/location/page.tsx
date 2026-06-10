import LocationForm from '@/components/forms/inventory/location/LocationForm';
import { serverFetch } from '@/lib/fetch';
import { notFound } from 'next/navigation';

export default async function LocationPage() {
    const res = await serverFetch(
        `${process.env.NEXT_PUBLIC_APP_URL}/api/location`,
        { cache: 'no-store' },
    );

    if (!res.ok) notFound();

    const json = await res.json();

    return <LocationForm branches={json.data} />;
}
