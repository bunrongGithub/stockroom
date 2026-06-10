import POSClient from '@/components/forms/sales/pos/POSClient';
import { ToastProvider } from '@/components/ui/Toast';
import { getSession } from '@/lib/auth';
import { serverFetch } from '@/lib/fetch';
import { getServerClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';

export default async function POSPage() {
    const session = await getSession();
    if (!session) redirect('/signin');

    const API_URL = `${process.env.NEXT_PUBLIC_APP_URL}/api/inventory`;
    const res = await serverFetch(API_URL, { cache: 'no-store' });
    if (!res.ok) notFound();
    const json = await res.json();
    const items = json.data || [];

    const supabase = getServerClient();
    const { data: branchData } = await supabase
        .from('warehouse')
        .select(
            `
            *,
            user_branch!inner(user_id, role),
            stock_location(*)
        `,
        )
        .eq('user_branch.user_id', session.userId)
        .eq('is_active', true)
        .order('name');

    const branches = branchData ?? [];

    return (
        <ToastProvider>
            <POSClient items={items} branches={branches} />
        </ToastProvider>
    );
}
