import { createClient } from '@/lib/supabase/server';
import {
    itemIdSchema,
    updateInventorySchema,
} from '@/lib/validations/inventory.schema';
import { NextRequest, NextResponse } from 'next/server';
import { service } from '..';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
    try {
        const { id } = await params;

        const parsed = itemIdSchema.safeParse({ id });
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid ID format' },
                { status: 400 },
            );
        }

        // 1. Existing item data (unchanged)
        const item = await service.getById(parsed.data.id);

        // 2. NEW: fetch stock balances per location for this item
        const supabase = await createClient();
        const { data: balances } = await supabase
            .from('inventory_stock_balance')
            .select(`
                quantity,
                stock_location:location_id (
                    id,
                    name,
                    is_default,
                    branch:branch_id ( id, name, is_default )
                )
            `)
            .eq('item_id', parsed.data.id);

        // 3. Pick the default location (or first available) to display
        const rows = balances ?? [];
        const defaultRow =
            rows.find((r: any) => r.stock_location?.is_default) ?? rows[0] ?? null;

        const stock_location = defaultRow
            ? {
                  location_id: (defaultRow.stock_location as any)?.id ?? null,
                  location_name: (defaultRow.stock_location as any)?.name ?? null,
                  branch_name:
                      (defaultRow.stock_location as any)?.branch?.name ?? null,
                  quantity: Number(defaultRow.quantity ?? 0),
              }
            : null;

        // 4. Merge: keep all existing item fields, attach location info
        const enriched = {
            ...item,
            stock_location,
            // also expose total on-hand from balances (sum across locations)
            stock_balances: rows.map((r: any) => ({
                location_name: r.stock_location?.name ?? '—',
                branch_name: r.stock_location?.branch?.name ?? '—',
                quantity: Number(r.quantity ?? 0),
            })),
        };

        return NextResponse.json({ data: enriched }, { status: 200 });
    } catch (error) {
        const message =
            error instanceof Error ? error.message : 'Unexpected error';
        const status = message.includes('not found') ? 404 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}

export async function PATCH(req: NextRequest, { params }: Params) {
    try {
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
                { error: bodyParsed.error.flatten().fieldErrors },
                { status: 422 },
            );
        }

        const item = await service.update(parsed.data.id, bodyParsed.data);
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

export async function DELETE(_req: NextRequest, { params }: Params) {
    try {
        const { id } = await params;

        const parsed = itemIdSchema.safeParse({ id });
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid ID format' },
                { status: 400 },
            );
        }

        await service.delete(parsed.data.id);
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