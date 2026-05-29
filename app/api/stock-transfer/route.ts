import { createClient } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

// POST /api/stock-transfer
// Body: { item_id, from_location_id, to_location_id, quantity, reason? }
export async function POST(req: NextRequest) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user)
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { item_id, from_location_id, to_location_id, quantity, reason } =
        body;

    // ── Validation ──
    if (!item_id || !from_location_id || !to_location_id || !quantity) {
        return NextResponse.json(
            {
                error: 'item_id, from_location_id, to_location_id, and quantity are required.',
            },
            { status: 400 },
        );
    }

    if (from_location_id === to_location_id) {
        return NextResponse.json(
            { error: 'Source and destination locations must be different.' },
            { status: 400 },
        );
    }

    if (quantity <= 0) {
        return NextResponse.json(
            { error: 'Quantity must be greater than 0.' },
            { status: 400 },
        );
    }

    // ── Check source balance ──
    const { data: srcBalance, error: srcErr } = await supabase
        .from('inventory_stock_balance')
        .select('id, quantity')
        .eq('item_id', item_id)
        .eq('location_id', from_location_id)
        .single();

    if (srcErr || !srcBalance) {
        return NextResponse.json(
            { error: 'Item not found in source location.' },
            { status: 404 },
        );
    }

    if (srcBalance.quantity < quantity) {
        return NextResponse.json(
            { error: `Insufficient stock. Available: ${srcBalance.quantity}` },
            { status: 400 },
        );
    }

    // ── Deduct from source ──
    const newSrcQty = srcBalance.quantity - quantity;
    const { error: deductErr } = await supabase
        .from('inventory_stock_balance')
        .update({ quantity: newSrcQty, updated_at: new Date().toISOString() })
        .eq('id', srcBalance.id);

    if (deductErr) {
        return NextResponse.json(
            { error: 'Failed to deduct from source.' },
            { status: 500 },
        );
    }

    // ── Add to destination (upsert) ──
    const { data: destBalance } = await supabase
        .from('inventory_stock_balance')
        .select('id, quantity')
        .eq('item_id', item_id)
        .eq('location_id', to_location_id)
        .maybeSingle();

    if (destBalance) {
        const { error: addErr } = await supabase
            .from('inventory_stock_balance')
            .update({
                quantity: destBalance.quantity + quantity,
                updated_at: new Date().toISOString(),
            })
            .eq('id', destBalance.id);

        if (addErr) {
            // Rollback source
            await supabase
                .from('inventory_stock_balance')
                .update({ quantity: srcBalance.quantity })
                .eq('id', srcBalance.id);
            return NextResponse.json(
                { error: 'Failed to add to destination.' },
                { status: 500 },
            );
        }
    } else {
        const { error: insertErr } = await supabase
            .from('inventory_stock_balance')
            .insert({
                item_id,
                location_id: to_location_id,
                quantity,
            });

        if (insertErr) {
            await supabase
                .from('inventory_stock_balance')
                .update({ quantity: srcBalance.quantity })
                .eq('id', srcBalance.id);
            return NextResponse.json(
                { error: 'Failed to create destination balance.' },
                { status: 500 },
            );
        }
    }

    // ── Record movement ──
    await supabase.from('inventory_stock_movement').insert({
        item_id,
        from_location_id,
        to_location_id,
        quantity,
        movement_type: 'transfer',
        reason: reason || null,
        user_id: user.id,
    });

    return NextResponse.json({
        success: true,
        message: 'Stock transferred successfully.',
    });
}
