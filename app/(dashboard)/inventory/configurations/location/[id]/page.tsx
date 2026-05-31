import { serverFetch } from '@/lib/server-fetch';
import { notFound } from 'next/navigation';
import BranchDetailClient from './BranchDetailClient';

type Params = { params: Promise<{ id: string }> };

const BASE = process.env.NEXT_PUBLIC_APP_URL;

export default async function BranchDetailPage({ params }: Params) {
    const { id } = await params;

    const [branchRes, locationsRes, balancesRes] = await Promise.all([
        serverFetch(`${BASE}/api/branch/${id}`, { cache: 'no-store' }),
        serverFetch(`${BASE}/api/stock-location?branch_id=${id}`, { cache: 'no-store' }),
        serverFetch(`${BASE}/api/stock-balance?branch_id=${id}`, { cache: 'no-store' }),
    ]);

    if (!branchRes.ok) notFound();

    const { data: branch } = await branchRes.json();
    const locJson = locationsRes.ok ? await locationsRes.json() : { data: [] };
    const balances = balancesRes.ok ? await balancesRes.json() : [];

    return (
        <BranchDetailClient
            branch={branch}
            locations={locJson.data ?? []}
            balances={Array.isArray(balances) ? balances : []}
        />
    );
}
