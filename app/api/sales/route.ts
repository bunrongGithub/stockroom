import { SaleService } from '@/lib/services/sale.service';
import { createClient } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { payload, cart, locationId } = body;

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

        const service = SaleService.getInstance();

        // Pass everything to the service, which handles stock deduction
        // and sale creation atomically (within repository logic).
        const saleData = await service.create({
            customerName: payload.customerName,
            customerPhone: payload.customerPhone,
            items: cart,
            status: payload.status,
            discountValue: payload.discountValue,
            discountType: payload.discountType,
            warranty: cart.length > 0 ? cart[0].warranty_months || 0 : 0,
            locationId: locationId,
            userId: user.id,
        });

        return NextResponse.json({ success: true, sale: saleData });
    } catch (error: any) {
        console.error('Checkout error:', error);

        // Return 400 for business logic errors like "Insufficient stock"
        const status = error.message?.includes('Insufficient stock')
            ? 400
            : 500;
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status },
        );
    }
}
