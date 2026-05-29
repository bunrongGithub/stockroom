import ProductDashboard, {
    StockBalanceWithLocation,
} from '@/components/forms/inventory/ProductDashboard';
import { createClient } from '@/lib/supabase';
import { notFound } from 'next/navigation';

type RawWarehouse = { id: number; name: string };
type RawStockLocation = {
    id: number;
    name: string;
    code: string | null;
    is_default: boolean;
    branch_id: number;
    warehouse: RawWarehouse | RawWarehouse[] | null;
};
type RawStockBalance = {
    id: number;
    quantity: number | string;
    location_id: number;
    updated_at: string;
    stock_location: RawStockLocation | RawStockLocation[] | null;
};

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
    if (Array.isArray(value)) return value[0] ?? null;
    return value ?? null;
}

interface PageProps {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ create_success?: string; stock?: string }>;
}

async function page({ params, searchParams }: PageProps) {
    const { id } = await params;
    const { create_success, stock } = await searchParams; // 👈 await it

    const isNewStock = create_success === 'true' && stock === 'true';

    const API_URL = `${process.env.NEXT_PUBLIC_APP_URL}/api/inventory/${id}`;
    const res = await fetch(API_URL);
    if (!res.ok) notFound();

    const json = await res.json();
    const item = json.data;

    const supabase = await createClient();
    const { data: stockBalances } = await supabase
        .from('inventory_stock_balance')
        .select(
            `
            id,
            quantity,
            location_id,
            updated_at,
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
        .eq('item_id', item.id)
        .gt('quantity', 0)
        .order('quantity', { ascending: false });

    const normalizedStockBalances: StockBalanceWithLocation[] = (
        (stockBalances ?? []) as unknown as RawStockBalance[]
    ).map((balance) => {
        const location = firstRelation(balance.stock_location);
        const warehouse = firstRelation(location?.warehouse);

        return {
            id: balance.id,
            quantity: Number(balance.quantity ?? 0),
            location_id: balance.location_id,
            updated_at: balance.updated_at,
            stock_location: location
                ? {
                      id: location.id,
                      name: location.name,
                      code: location.code,
                      is_default: location.is_default,
                      branch_id: location.branch_id,
                      warehouse,
                  }
                : null,
        };
    });

    return (
        <div>
            <ProductDashboard
                item={item}
                stockBalances={normalizedStockBalances}
                autoOpenStockModal={isNewStock}
            />
        </div>
    );
}

export default page;
