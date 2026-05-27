import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/stock-balance?branch_id=1  or  ?location_id=5
export async function GET(req: NextRequest) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const branchId = req.nextUrl.searchParams.get('branch_id');
    const locationId = req.nextUrl.searchParams.get('location_id');

    let query = supabase
        .from('inventory_stock_balance')
        .select(`
            id,
            quantity,
            item_id,
            location_id,
            updated_at,
            inventory_item ( id, name, sku, reference_no, images_url, price, sale_price ),
            stock_location ( id, name, code, branch_id )
        `)
        .gt('quantity', 0);

    if (locationId) {
        query = query.eq('location_id', locationId);
    } else if (branchId) {
        query = query.eq('stock_location.branch_id', branchId);
    }

    query = query.order('updated_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Filter out rows where stock_location is null (branch_id filter via nested)
    const filtered = branchId ? data?.filter((d: any) => d.stock_location !== null) : data;

    return NextResponse.json(filtered ?? []);
}