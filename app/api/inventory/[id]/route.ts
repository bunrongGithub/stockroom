import {
    itemIdSchema,
    updateInventorySchema,
} from '@/service/schema/inventory.schema';
import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { getServerClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { service } from '..';

type Params = { params: Promise<{ id: string }> };
type BranchJoin = {
    id: number | null;
    name: string | null;
    is_default?: boolean | null;
};
type StockLocationRelation = {
    id: number | null;
    name: string | null;
    is_default: boolean | null;
    branch: BranchJoin | BranchJoin[] | null;
};
type BalanceRow = {
    quantity: number | string | null;
    stock_location: StockLocationRelation | StockLocationRelation[] | null;
};

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
    if (Array.isArray(value)) return value[0] ?? null;
    return value ?? null;
}

export async function GET(req: NextRequest, { params }: Params) {
    try {
        const ctx = getRequestContext(req);
        const { id } = await params;

        const parsed = itemIdSchema.safeParse({ id });
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid ID format' },
                { status: 400 },
            );
        }

        const item = await service.findOne(ctx, parsed.data.id);
        if (!item) {
            return NextResponse.json(
                { error: 'Item not found' },
                { status: 404 },
            );
        }

        const supabase = getServerClient();
        const { data: balances } = await supabase
            .from('inventory_stock_balance')
            .select(
                `quantity,
                stock_location:location_id (
                    id, name, is_default,
                    branch:branch_id ( id, name, is_default )
                )`,
            )
            .eq('item_id', parsed.data.id);

        const rows = ((balances ?? []) as unknown as BalanceRow[]).map(
            (row) => {
                const location = firstRelation(row.stock_location);
                const branch = firstRelation(location?.branch);
                return {
                    quantity: row.quantity,
                    stock_location: location ? { ...location, branch } : null,
                };
            },
        );

        const defaultRow =
            rows.find((r) => r.stock_location?.is_default) ?? rows[0] ?? null;

        return NextResponse.json(
            {
                data: {
                    ...item,
                    stock_location: defaultRow
                        ? {
                              location_id:
                                  defaultRow.stock_location?.id ?? null,
                              location_name:
                                  defaultRow.stock_location?.name ?? null,
                              branch_name:
                                  defaultRow.stock_location?.branch?.name ??
                                  null,
                              quantity: Number(defaultRow.quantity ?? 0),
                          }
                        : null,
                    stock_balances: rows.map((r) => ({
                        location_name: r.stock_location?.name ?? '—',
                        branch_name: r.stock_location?.branch?.name ?? '—',
                        quantity: Number(r.quantity ?? 0),
                    })),
                },
            },
            { status: 200 },
        );
    } catch (error) {
        const message =
            error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest, { params }: Params) {
    try {
        const ctx = getRequestContext(req);
        const { id } = await params;

        const parsed = itemIdSchema.safeParse({ id });
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid ID format' },
                { status: 400 },
            );
        }

        const body = await req.json();
        const bodyParsed = updateInventorySchema.safeParse(body);
        if (!bodyParsed.success) {
            return NextResponse.json(
                { error: z.flattenError(bodyParsed.error).fieldErrors },
                { status: 422 },
            );
        }

        const item = await service.updateOne(
            ctx,
            parsed.data.id,
            bodyParsed.data,
        );
        return NextResponse.json({ data: item }, { status: 200 });
    } catch (error) {
        const message =
            error instanceof Error ? error.message : 'Unexpected error';
        const status = message.includes('not found')
            ? 404
            : message.includes('already exists')
              ? 409
              : 500;
        return NextResponse.json({ error: message }, { status });
    }
}

export async function DELETE(req: NextRequest, { params }: Params) {
    try {
        const ctx = getRequestContext(req);
        const { id } = await params;

        const parsed = itemIdSchema.safeParse({ id });
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid ID format' },
                { status: 400 },
            );
        }

        await service.deleteOne(ctx, parsed.data.id);
        return NextResponse.json(
            { message: 'Item deleted successfully' },
            { status: 200 },
        );
    } catch (error) {
        const message =
            error instanceof Error ? error.message : 'Unexpected error';
        const status = message.includes('not found') ? 404 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}
