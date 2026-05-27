import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { payload, cart, locationId } = body;
        
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 1. Generate Sale No (simple version)
        const { count } = await supabase
            .from('sales')
            .select('*', { count: 'exact', head: true });
            
        const nextNo = (count || 0) + 1;
        const sale_no = String(nextNo).padStart(8, '0');

        // 2. Handle Customer (Find or Create)
        let customer_id = null;
        if (payload.customerName || payload.customerPhone) {
            // Try to find existing
            let query = supabase.from('customers').select('id');
            if (payload.customerPhone) {
                query = query.eq('phone', payload.customerPhone);
            } else {
                query = query.eq('name', payload.customerName);
            }
            
            const { data: existingCust } = await query.limit(1).maybeSingle();
            
            if (existingCust) {
                customer_id = existingCust.id;
            } else {
                const { data: newCust, error: custErr } = await supabase
                    .from('customers')
                    .insert({
                        name: payload.customerName || 'Unknown',
                        phone: payload.customerPhone || null,
                    })
                    .select('id')
                    .single();
                    
                if (custErr) throw custErr;
                customer_id = newCust.id;
            }
        }

        // 3. Deduct Stock if Status is Completed
        // (If Pending Repair, we might just reserve it, but for simplicity let's deduct only if completed, or deduct anyway)
        // Usually, POS deducts stock on sale regardless, but let's deduct if it's a physical item.
        if (payload.status !== 'Refunded') {
            for (const item of cart) {
                if (!item.is_service && locationId) {
                    // Find balance
                    const { data: balanceRow } = await supabase
                        .from('inventory_stock_balance')
                        .select('id, quantity')
                        .eq('item_id', item.item_id)
                        .eq('location_id', locationId)
                        .maybeSingle();

                    const currentQty = Number(balanceRow?.quantity ?? 0);
                    const newQty = Math.max(0, currentQty - item.qty);

                    if (balanceRow) {
                        await supabase
                            .from('inventory_stock_balance')
                            .update({ quantity: newQty, updated_at: new Date().toISOString() })
                            .eq('id', balanceRow.id);
                    }
                    
                    // Log movement
                    await supabase.from('inventory_stock_movement').insert({
                        item_id: item.item_id,
                        from_location_id: locationId,
                        to_location_id: null,
                        quantity: item.qty,
                        movement_type: 'out',
                        reason: `POS Sale #${sale_no}`,
                        user_id: user.id,
                    });

                    // Update global stock
                    const { data: allBalances } = await supabase
                        .from('inventory_stock_balance')
                        .select('quantity')
                        .eq('item_id', item.item_id);
                        
                    const totalStock = (allBalances || []).reduce((sum, row) => sum + Number(row.quantity || 0), 0);
                    
                    await supabase
                        .from('inventory_item')
                        .update({ stock: totalStock, updated_at: new Date().toISOString() })
                        .eq('id', item.item_id);
                }
            }
        }

        // 4. Create Sale Record
        const totalAmount = cart.reduce((sum: number, item: any) => sum + (item.price * item.qty), 0);
        const description = cart.map((i: any) => i.name).join(', ');

        const salePayload = {
            sale_no,
            customer_id,
            amount: totalAmount,
            description,
            status: payload.status,
            items: cart,
            discount_value: payload.discountValue || 0,
            discount_type: payload.discountType || 'fixed',
            warranty: cart.length > 0 ? (cart[0].warranty_months || 0) : 0, // Simplified warranty tracking
            // In a real system you might want payment_method saved, but schema might not have it. We can stick it in description or ignore if not in schema.
        };

        const { data: saleData, error: saleErr } = await supabase
            .from('sales')
            .insert(salePayload)
            .select()
            .single();

        if (saleErr) throw saleErr;

        return NextResponse.json({ success: true, sale: saleData });

    } catch (error: any) {
        console.error('Checkout error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
