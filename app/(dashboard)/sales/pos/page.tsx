import POSClient from '@/components/forms/sales/pos/POSClient';
import { ToastProvider } from '@/components/ui/Toast';
import { createClient } from '@/lib/supabase';
import { notFound, redirect } from 'next/navigation';

export default async function POSPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect('/login');

    const API_URL = `${process.env.NEXT_PUBLIC_APP_URL}/api/inventory`;

    const res = await fetch(API_URL, { cache: 'no-store' });
    if (!res.ok) notFound();
    const json = await res.json();
    const items = json.data || [];

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

    const branches = branchData ?? [];

    return (
        <ToastProvider>
            <POSClient items={items} branches={branches} />
        </ToastProvider>
    );
}
