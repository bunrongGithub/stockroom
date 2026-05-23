import LocationForm from '@/components/forms/inventory/location/LocationForm';
import { notFound } from 'next/navigation';

interface PageProps {
    searchParams: Promise<{ page?: string; limit?: string; search?: string }>;
}

export default async function page({ searchParams }: PageProps) {
    const { page = '1', limit = '10', search = '' } = await searchParams;

    const params = new URLSearchParams({ page, limit, search });
    const API_URL = `${process.env.NEXT_PUBLIC_APP_URL}/api/location?${params}`;

    const res = await fetch(API_URL, { cache: 'no-store' });
    if (!res.ok) notFound();

    const json = await res.json();
    const data = json.data;
    return <LocationForm branches={data} />;
}
