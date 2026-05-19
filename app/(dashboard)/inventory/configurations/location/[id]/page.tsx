import { createClient } from '@/lib/supabase/server';
import { BranchProps } from '@/types/branch';
import { notFound, redirect } from 'next/navigation';
import BranchDetailClient from './BranchDetailClient';

type Params = { params: Promise<{ id: string }> };

export default async function BranchDetailPage({ params }: Params) {
    const { id } = await params;
    const branchId = Number(id);
    if (!Number.isFinite(branchId) || branchId <= 0) notFound();

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    const { data, error } = await supabase
        .from('branch')
        .select('*, stock_location(*)')
        .eq('id', branchId)
        .single();

    if (error || !data) notFound();

    const branch: BranchProps = data;
    return <BranchDetailClient branch={branch} />;
}