import { createClient } from '@/lib/supabase/server';
import { itemIdSchema } from '@/lib/validations/inventory.schema';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const adjustStockSchema = z.object({
    received_quantity: z
        .number({ error: 'Received quantity must be a number' })
        .int('Quantity must be a whole number')
        .positive('Quantity must be greater than 0'),
    adjustment_reason: z
        .string({ error: 'Adjustment reason is required' })
        .min(1, 'Adjustment reason is required'),
    location_id: z
        .number({ error: 'Location is required' })
        .int()
        .positive(),
});

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
    try {
        const { id } = await params;
        const idParsed = itemIdSchema.safeParse({ id });
        if (!idParsed.success) {
            return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
        }

        const body = await req.json();
        const parsed = adjustStockSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error.flatten().fieldErrors },
                { status: 422 },
            );
        }

        const { received_quantity, adjustment_reason, location_id } = parsed.data;
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        // 1. Find current balance at this location (if any)
        const { data: balance } = await supabase
            .from('inventory_stock_balance')
            .select('id, quantity')
            .eq('item_id', idParsed.data.id)
            .eq('location_id', location_id)
            .maybeSingle();

        const newQty = Number(balance?.quantity ?? 0) + received_quantity;

        // 2. UPSERT balance
        const { error: balErr } = balance
            ? await supabase
                  .from('inventory_stock_balance')
                  .update({ quantity: newQty })
                  .eq('id', balance.id)
            : await supabase.from('inventory_stock_balance').insert({
                  item_id: idParsed.data.id,
                  location_id,
                  quantity: newQty,
              });

        if (balErr) return NextResponse.json({ error: balErr.message }, { status: 500 });

        // 3. Log the movement (audit trail)
        const { error: movErr } = await supabase.from('inventory_stock_movement').insert({
            item_id: idParsed.data.id,
            to_location_id: location_id,
            quantity: received_quantity,
            movement_type: 'adjustment',
            reason: adjustment_reason,
            user_id: user?.id,
        });

        if (movErr) return NextResponse.json({ error: movErr.message }, { status: 500 });

        // 4. inventory_item.stock auto-syncs via trigger we created in Phase 1
        return NextResponse.json({ data: { new_quantity: newQty } }, { status: 200 });
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unexpected error';
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}