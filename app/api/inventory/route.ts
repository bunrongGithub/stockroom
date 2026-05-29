import { createClient } from '@/lib/supabase';
import { createInventorySchema } from '@/lib/validations/inventory.schema';
import { NextRequest, NextResponse } from 'next/server';
import { service } from '.';

type BalanceRow = {
    item_id: number;
    quantity: number | string | null;
    stock_location: StockLocationJoin | StockLocationJoin[] | null;
};

type StockLocationJoin = {
    id: number | null;
    name: string | null;
    code: string | null;
    is_default: boolean | null;
    branch_id: number | null;
    branch: BranchJoin | BranchJoin[] | null;
};

type BranchJoin = {
    id: number | null;
    name: string | null;
};

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
    if (Array.isArray(value)) return value[0] ?? null;
    return value ?? null;
}

type NormalizedBalanceRow = {
    item_id: number;
    quantity: number | string | null;
    stock_location: {
        id: number | null;
        name: string | null;
        code: string | null;
        is_default: boolean | null;
        branch_id: number | null;
        branch: { id: number | null; name: string | null } | null;
    } | null;
};

export async function GET() {
    try {
        const items = await service.getAll();
        const itemIds = items.map((item) => item.id).filter(Boolean);

        if (itemIds.length === 0) {
            return NextResponse.json({ data: items }, { status: 200 });
        }

        const supabase = await createClient();
        const { data: balances, error } = await supabase
            .from('inventory_stock_balance')
            .select(
                `
                item_id,
                quantity,
                stock_location:location_id (
                    id,
                    name,
                    code,
                    is_default,
                    branch_id,
                    branch:branch_id ( id, name )
                )
            `,
            )
            .in('item_id', itemIds);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const balanceRows = ((balances ?? []) as unknown as BalanceRow[]).map(
            (row): NormalizedBalanceRow => {
                const location = firstRelation(row.stock_location);
                const branch = firstRelation(location?.branch);

                return {
                    item_id: row.item_id,
                    quantity: row.quantity,
                    stock_location: location
                        ? {
                              id: location.id,
                              name: location.name,
                              code: location.code,
                              is_default: location.is_default,
                              branch_id: location.branch_id,
                              branch,
                          }
                        : null,
                };
            },
        );

        const balancesByItem = new Map<number, NormalizedBalanceRow[]>();
        balanceRows.forEach((row) => {
            const rows = balancesByItem.get(row.item_id) ?? [];
            rows.push(row);
            balancesByItem.set(row.item_id, rows);
        });

        const enriched = items.map((item) => {
            const rows = balancesByItem.get(item.id) ?? [];
            const defaultRow =
                rows.find((row) => row.stock_location?.is_default) ??
                rows[0] ??
                null;

            return {
                ...item,
                stock_location: defaultRow
                    ? {
                          location_id: defaultRow.stock_location?.id ?? null,
                          location_name:
                              defaultRow.stock_location?.name ?? null,
                          branch_name:
                              defaultRow.stock_location?.branch?.name ?? null,
                          quantity: Number(defaultRow.quantity ?? 0),
                      }
                    : null,
                stock_balances: rows.map((row) => ({
                    location_id: row.stock_location?.id ?? null,
                    location_name: row.stock_location?.name ?? '—',
                    location_code: row.stock_location?.code ?? null,
                    branch_id: row.stock_location?.branch_id ?? null,
                    branch_name: row.stock_location?.branch?.name ?? '—',
                    quantity: Number(row.quantity ?? 0),
                })),
            };
        });

        return NextResponse.json({ data: enriched }, { status: 200 });
    } catch (error) {
        const message =
            error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        const parsed = createInventorySchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error.flatten().fieldErrors },
                { status: 422 },
            );
        }

        const item = await service.create(parsed.data);
        return NextResponse.json({ data: item }, { status: 201 });
    } catch (error) {
        const message =
            error instanceof Error ? error.message : 'Unexpected error';
        const status = message.includes('already exists') ? 409 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}
