import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import BranchDetailClient from './BranchDetailClient';

type Params = { params: Promise<{ id: string }> };

export default async function BranchDetailPage({ params }: Params) {
    const { id } = await params;
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect('/login');

    // ── Load branch from warehouse table ──
    const { data: branch, error: branchErr } = await supabase
        .from('warehouse')
        .select('*')
        .eq('id', id)
        .single();

    if (branchErr || !branch) {
        console.error('Branch not found:', branchErr?.message);
        redirect('/inventory/configurations/location');
    }

    // ── Verify user has access ──
    const { data: access } = await supabase
        .from('user_branch')
        .select('role')
        .eq('user_id', user.id)
        .eq('branch_id', branch.id)
        .single();

    if (!access) {
        console.error('No access for user to branch', branch.id);
        redirect('/inventory/configurations/location');
    }

    // ── Load stock locations ──
    const { data: locations, error: locErr } = await supabase
        .from('stock_location')
        .select('*')
        .eq('branch_id', branch.id)
        .order('is_default', { ascending: false })
        .order('name');

    if (locErr) {
        console.error('Failed to load locations:', locErr.message);
    }

    // ── Load stock balances with item info ──
    const locationIds = (locations ?? []).map((l: any) => l.id);
    let balances: any[] = [];

    if (locationIds.length > 0) {
        const { data: balanceData, error: balErr } = await supabase
            .from('inventory_stock_balance')
            .select(`
                id,
                quantity,
                item_id,
                location_id,
                updated_at,
                inventory_item ( id, name, sku, reference_no, price, sale_price, images_url )
            `)
            .in('location_id', locationIds)
            .gt('quantity', 0)
            .order('updated_at', { ascending: false });

        if (balErr) {
            console.error('Failed to load balances:', balErr.message);
        }
        balances = balanceData ?? [];
    }

    return (
        <BranchDetailClient
            branch={branch}
            locations={locations ?? []}
            balances={balances}
            userRole={access.role}
        />
    );
}