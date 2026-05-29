import { createClient } from '@/lib/supabase';
import { itemIdSchema } from '@/lib/validations/inventory.schema';
import { NextRequest, NextResponse } from 'next/server';
import { service } from '..';

type Params = { params: Promise<{ id: string }> };
type BranchRelation = {
    id: number | null;
    name: string | null;
    is_default?: boolean | null;
};
type StockLocationRelation = {
    id: number | null;
    name: string | null;
    is_default: boolean | null;
    branch: BranchRelation | BranchRelation[] | null;
};
type BalanceRow = {
    quantity: number | string | null;
    stock_location: StockLocationRelation | StockLocationRelation[] | null;
};

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
    if (Array.isArray(value)) return value[0] ?? null;
    return value ?? null;
}

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
            .select(
                `
                quantity,
                stock_location:location_id (
                    id,
                    name,
                    is_default,
                    branch:branch_id ( id, name, is_default )
                )
            `,
            )
            .eq('item_id', parsed.data.id);

        // 3. Pick the default location (or first available) to display
        const rows = ((balances ?? []) as unknown as BalanceRow[]).map(
            (row) => {
                const location = firstRelation(row.stock_location);
                return {
                    quantity: row.quantity,
                    stock_location: location
                        ? {
                              ...location,
                              branch: firstRelation(location.branch),
                          }
                        : null,
                };
            },
        );
        const defaultRow =
            rows.find((row) => row.stock_location?.is_default) ??
            rows[0] ??
            null;

        const stock_location = defaultRow
            ? {
                  location_id: defaultRow.stock_location?.id ?? null,
                  location_name: defaultRow.stock_location?.name ?? null,
                  branch_name: defaultRow.stock_location?.branch?.name ?? null,
                  quantity: Number(defaultRow.quantity ?? 0),
              }
            : null;

        // 4. Merge: keep all existing item fields, attach location info
        const enriched = {
            ...item,
            stock_location,
            // also expose total on-hand from balances (sum across locations)
            stock_balances: rows.map((row) => ({
                location_name: row.stock_location?.name ?? '—',
                branch_name: row.stock_location?.branch?.name ?? '—',
                quantity: Number(row.quantity ?? 0),
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
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 },
            );
        }

        const parsed = itemIdSchema.safeParse({ id });
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid ID format' },
                { status: 400 },
            );
        }

        const body = await req.json();
        const {
            name,
            purchase_price,
            sale_price,
            description,
            category_id,
            uom_id,
        } = body;

        if (!name?.trim()) {
            return NextResponse.json(
                { error: 'Name is required' },
                { status: 400 },
            );
        }

        const salePrice = Number(sale_price) || 0;
        const { data, error } = await supabase
            .from('inventory_item')
            .update({
                name: name.trim(),
                purchase_price: Number(purchase_price) || 0,
                sale_price: salePrice,
                price: salePrice,
                description: description ?? null,
                category_id: category_id ? Number(category_id) : null,
                uom_id: uom_id ? Number(uom_id) : null,
                updated_at: new Date().toISOString(),
            })
            .eq('id', parsed.data.id)
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ data }, { status: 200 });
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
