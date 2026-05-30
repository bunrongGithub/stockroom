import { createInventorySchema } from '@/service/schema/inventory.schema';
import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { getServerClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { service } from '.';

type StockLocationJoin = {
    id: number | null;
    name: string | null;
    code: string | null;
    is_default: boolean | null;
    branch_id: number | null;
    branch: { id: number | null; name: string | null } | BranchJoin[] | null;
};
type BranchJoin = { id: number | null; name: string | null };
type BalanceRow = {
    item_id: number;
    quantity: number | string | null;
    stock_location: StockLocationJoin | StockLocationJoin[] | null;
};

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
    if (Array.isArray(value)) return value[0] ?? null;
    return value ?? null;
}

export async function GET(req: NextRequest) {
    try {
        const ctx = getRequestContext(req);
        const searchParams = req.nextUrl.searchParams;

        const page = Number(searchParams.get('page') || 1);
        const limit = Number(searchParams.get('limit') || 10);
        const search = searchParams.get('search') ?? undefined;

        const result = await service.findAll(ctx, {
            page,
            limit,
            search,
            searchColumn: 'name',
        });

        const itemIds = result.data.map((item) => item.id).filter(Boolean);
        if (itemIds.length === 0) {
            return NextResponse.json({ data: result }, { status: 200 });
        }

        const supabase = getServerClient();
        const { data: balances, error } = await supabase
            .from('inventory_stock_balance')
            .select(
                `item_id, quantity,
                stock_location:location_id (
                    id, name, code, is_default, branch_id,
                    branch:branch_id ( id, name )
                )`,
            )
            .in('item_id', itemIds);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const balancesByItem = new Map<number, BalanceRow[]>();
        ((balances ?? []) as unknown as BalanceRow[]).forEach((row) => {
            const rows = balancesByItem.get(row.item_id) ?? [];
            rows.push(row);
            balancesByItem.set(row.item_id, rows);
        });

        const enriched = result.data.map((item) => {
            const rows = balancesByItem.get(item.id) ?? [];
            const defaultRow =
                rows.find((r) => firstRelation(r.stock_location)?.is_default) ??
                rows[0] ??
                null;

            const normalizedRows = rows.map((r) => {
                const loc = firstRelation(r.stock_location);
                const branch = firstRelation(loc?.branch as BranchJoin | BranchJoin[] | null);
                return {
                    location_id: loc?.id ?? null,
                    location_name: loc?.name ?? '—',
                    location_code: loc?.code ?? null,
                    branch_id: loc?.branch_id ?? null,
                    branch_name: branch?.name ?? '—',
                    quantity: Number(r.quantity ?? 0),
                };
            });

            const defLoc = firstRelation(defaultRow?.stock_location ?? null);
            const defBranch = firstRelation(defLoc?.branch as BranchJoin | BranchJoin[] | null);

            return {
                ...item,
                stock_location: defaultRow
                    ? {
                          location_id: defLoc?.id ?? null,
                          location_name: defLoc?.name ?? null,
                          branch_name: defBranch?.name ?? null,
                          quantity: Number(defaultRow.quantity ?? 0),
                      }
                    : null,
                stock_balances: normalizedRows,
            };
        });

        return NextResponse.json({ data: { ...result, data: enriched } }, { status: 200 });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const ctx = getRequestContext(req);
        const body = await req.json();

        const parsed = createInventorySchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: z.flattenError(parsed.error).fieldErrors },
                { status: 422 },
            );
        }

        const item = await service.insertOne(ctx, parsed.data);
        return NextResponse.json({ data: item }, { status: 201 });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        const status = message.includes('already exists') ? 409 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}
