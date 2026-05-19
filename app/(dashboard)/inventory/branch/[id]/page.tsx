import { redirect } from 'next/navigation';

type Params = { params: Promise<{ id: string }> };

export default async function LegacyBranchDetailPage({ params }: Params) {
    const { id } = await params;
    redirect(`/inventory/configurations/location/${id}`);
}
