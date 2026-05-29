import StockForm from '@/components/forms/inventory/stock/StockForm';
import { createClient } from '@/lib/supabase';
import { BranchProps } from '@/types/branch';
import { notFound, redirect } from 'next/navigation';

async function page() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    const API_URL = `${process.env.NEXT_PUBLIC_APP_URL}/api/inventory`;

    const res = await fetch(API_URL, { cache: 'no-store' });
    if (!res.ok) notFound();
    const json = await res.json();
    const items = json.data;

    const { data: branchData } = await supabase
        .from('warehouse')
        .select(
            `
            *,
            user_branch!inner(user_id, role),
            stock_location(*)
        `,
        )
        .eq('user_branch.user_id', user.id)
        .eq('is_active', true)
        .order('name');

    const branches: BranchProps[] = branchData ?? [];

    return <StockForm inv_items={items} branches={branches} />;
}

export default page;
