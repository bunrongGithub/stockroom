import StockForm from '@/components/forms/inventory/stock/StockForm';
import { createClient } from '@/lib/supabase/server';
import { BranchProps } from '@/types/branch';
import { InventoryItemProps } from '@/types/inventory/item';
import { notFound, redirect } from 'next/navigation';

type UserBranchRow = {
    branch_id: number | null;
};

type WarehouseRow = {
    id: number;
    name: string;
};

type StockLocationRow = {
    id: number;
    name: string | null;
    code: string | null;
    is_default: boolean | null;
    branch_id: number | null;
    warehouse: WarehouseRow | WarehouseRow[] | null;
};

type BalanceRow = {
    item_id: number | null;
    quantity: number | string | null;
    location_id: number | null;
    stock_location: StockLocationRow | StockLocationRow[] | null;
};

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
    if (Array.isArray(value)) return value[0] ?? null;
    return value ?? null;
}

export default async function NoneStockPage() {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    // 1. Fetch inventory items
    const API_URL = `${process.env.NEXT_PUBLIC_APP_URL}/api/inventory`;
    const res = await fetch(API_URL, { cache: 'no-store' });
    if (!res.ok) notFound();
    const json = await res.json();
    const items = (json.data ?? []) as InventoryItemProps[];

    // 2. Fetch user's branches with stock locations
    const { data: userBranchData } = await supabase
        .from('user_branch')
        .select('branch_id')
        .eq('user_id', user.id);

    const branchIds = ((userBranchData ?? []) as UserBranchRow[])
        .map((branch) => branch.branch_id)
        .filter((id): id is number => typeof id === 'number');

    let branches: BranchProps[] = [];
    if (branchIds.length > 0) {
        const { data: branchData } = await supabase
            .from('warehouse')
            .select(
                `
                id,
                name,
                reference_no,
                is_active,
                company_id,
                created_at,
                updated_at,
                stock_location (
                    id,
                    name,
                    code,
                    is_default,
                    is_active,
                    branch_id,
                    created_at,
                    updated_at,
                    description
                )
            `,
            )
            .in('id', branchIds)
            .eq('is_active', true);

        branches = (branchData ?? []) as unknown as BranchProps[];
    }

    // 3. Fetch stock balances and attach primary/all locations to stock items.
    const itemIds = items
        .filter((item) => item.item_class === 'stock' && typeof item.id === 'number')
        .map((item) => item.id as number);

    const primaryLocationMap = new Map<
        number,
        NonNullable<InventoryItemProps['stock_location']>
    >();
    const allBalancesMap = new Map<
        number,
        NonNullable<InventoryItemProps['stock_balances']>
    >();

    if (itemIds.length > 0) {
        const { data: balances } = await supabase
            .from('inventory_stock_balance')
            .select(
                `
                item_id,
                quantity,
                location_id,
                stock_location:location_id (
                    id,
                    name,
                    code,
                    is_default,
                    branch_id,
                    warehouse:branch_id ( id, name )
                )
            `,
            )
            .in('item_id', itemIds)
            .gt('quantity', 0)
            .order('quantity', { ascending: false });

        for (const row of (balances ?? []) as unknown as BalanceRow[]) {
            if (typeof row.item_id !== 'number' || typeof row.location_id !== 'number') {
                continue;
            }

            const location = firstRelation(row.stock_location);
            const warehouse = firstRelation(location?.warehouse);

            if (!primaryLocationMap.has(row.item_id)) {
                primaryLocationMap.set(row.item_id, {
                    location_id: row.location_id,
                    location_name: location?.name ?? null,
                    location_code: location?.code ?? null,
                    branch_id: location?.branch_id ?? null,
                    branch_name: warehouse?.name ?? null,
                    is_default: location?.is_default ?? false,
                    quantity: Number(row.quantity ?? 0),
                });
            }

            const itemBalances = allBalancesMap.get(row.item_id) ?? [];
            itemBalances.push({
                location_id: row.location_id,
                quantity: Number(row.quantity ?? 0),
            });
            allBalancesMap.set(row.item_id, itemBalances);
        }
    }

    const enrichedItems = items.map((item) =>
        item.item_class === 'stock' && typeof item.id === 'number'
            ? {
                  ...item,
                  stock_location: primaryLocationMap.get(item.id) ?? null,
                  stock_balances: allBalancesMap.get(item.id) ?? [],
              }
            : item,
    );

    return <StockForm inv_items={enrichedItems} branches={branches} />;
}
