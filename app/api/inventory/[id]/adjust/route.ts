import { itemIdSchema } from '@/service/schema/inventory.schema';
import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { getServerClient } from '@/lib/supabase/server';
import { z } from 'zod';

const adjustStockSchema = z.object({
    received_quantity: z
        .coerce.number({ error: 'Received quantity must be a number' })
        .int('Quantity must be a whole number')
        .positive('Quantity must be greater than 0'),
    adjustment_reason: z
        .string({ error: 'Adjustment reason is required' })
        .min(1, 'Adjustment reason is required'),
    location_id: z
        .coerce.number({ error: 'Location is required' })
        .int()
        .positive(),
    movement_type: z.enum(['in', 'out', 'adjustment']).default('in'),
});

type Params = { params: Promise<{ id: string }> };
type StockBalanceRow = { id: number; quantity: number };
type StockQuantityRow = { quantity: number | string | null };

export async function POST(req: NextRequest, { params }: Params) {
    try {
        const ctx = getRequestContext(req);
        const { id } = await params;

        const idParsed = itemIdSchema.safeParse({ id });
        if (!idParsed.success) {
            return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
        }

        const body = await req.json();
        const parsed = adjustStockSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: z.flattenError(parsed.error).fieldErrors },
                { status: 422 },
            );
        }

        const { received_quantity, adjustment_reason, location_id, movement_type } = parsed.data;
        const supabase = getServerClient();

        // Verify location exists and belongs to this company's warehouse
        const { data: location, error: locErr } = await supabase
            .from('stock_location')
            .select('id, branch_id')
            .eq('id', location_id)
            .eq('is_active', true)
            .single();

        if (locErr || !location) {
            return NextResponse.json({ error: 'Stock location not found' }, { status: 404 });
        }

        const { data: warehouse } = await supabase
            .from('warehouse')
            .select('id')
            .eq('id', location.branch_id)
            .eq('company_id', Number(ctx.companyId))
            .single();

        if (!warehouse) {
            return NextResponse.json({ error: 'No access to this stock location' }, { status: 403 });
        }

        // Find current balance at this location
        const { data: balanceRow } = await supabase
            .from('inventory_stock_balance')
            .select('id, quantity')
            .eq('item_id', idParsed.data.id)
            .eq('location_id', location_id)
            .maybeSingle();

        const balance = balanceRow as StockBalanceRow | null;
        const currentQty = Number(balance?.quantity ?? 0);
        const now = new Date().toISOString();
        let locationQuantity = currentQty;
        let balErr: { message: string } | null = null;

        if (movement_type === 'in') {
            locationQuantity = currentQty + received_quantity;
            const result = balance
                ? await supabase
                      .from('inventory_stock_balance')
                      .update({ quantity: locationQuantity, updated_at: now })
                      .eq('id', balance.id)
                : await supabase.from('inventory_stock_balance').insert({
                      item_id: idParsed.data.id,
                      location_id,
                      quantity: locationQuantity,
                  });
            balErr = result.error;
        }

        if (movement_type === 'out') {
            if (!balance || currentQty < received_quantity) {
                return NextResponse.json(
                    { error: `ស្តុកមិនគ្រប់គ្រាន់ក្នុងទីតាំងនេះ។ មាន: ${currentQty}` },
                    { status: 400 },
                );
            }
            locationQuantity = currentQty - received_quantity;
            const result = await supabase
                .from('inventory_stock_balance')
                .update({ quantity: locationQuantity, updated_at: now })
                .eq('id', balance.id);
            balErr = result.error;
        }

        if (movement_type === 'adjustment') {
            locationQuantity = received_quantity;
            const result = await supabase.from('inventory_stock_balance').upsert(
                {
                    item_id: idParsed.data.id,
                    location_id,
                    quantity: locationQuantity,
                    updated_at: now,
                },
                { onConflict: 'item_id,location_id' },
            );
            balErr = result.error;
        }

        if (balErr) return NextResponse.json({ error: balErr.message }, { status: 500 });

        // Log movement
        const { error: movErr } = await supabase.from('inventory_stock_movement').insert({
            item_id: idParsed.data.id,
            from_location_id: movement_type === 'out' || movement_type === 'adjustment' ? location_id : null,
            to_location_id: movement_type === 'in' || movement_type === 'adjustment' ? location_id : null,
            quantity: received_quantity,
            movement_type,
            reason: adjustment_reason,
            user_id: ctx.userId,
        });

        if (movErr) return NextResponse.json({ error: movErr.message }, { status: 500 });

        // Sync aggregate stock on inventory_item
        const { data: allBalances, error: totalErr } = await supabase
            .from('inventory_stock_balance')
            .select('quantity')
            .eq('item_id', idParsed.data.id);

        if (totalErr) return NextResponse.json({ error: totalErr.message }, { status: 500 });

        const totalStock = ((allBalances ?? []) as StockQuantityRow[]).reduce(
            (sum, row) => sum + Number(row.quantity ?? 0),
            0,
        );

        const { error: itemErr } = await supabase
            .from('inventory_item')
            .update({ stock: totalStock, updated_at: now })
            .eq('id', idParsed.data.id);

        if (itemErr) return NextResponse.json({ error: itemErr.message }, { status: 500 });

        return NextResponse.json(
            { data: { location_quantity: locationQuantity, total_stock: totalStock, movement_type } },
            { status: 200 },
        );
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unexpected error';
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
