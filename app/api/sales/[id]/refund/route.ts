import { createClient } from '@/lib/supabase/server';
import { SaleService } from '@/lib/services/sale.service';
import { NextRequest, NextResponse } from 'next/server';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { locationId } = body;

        if (!locationId) {
            return NextResponse.json(
                { error: 'locationId is required for refund to restore stock' },
                { status: 400 },
            );
        }

        const service = SaleService.getInstance();
        const sale = await service.refund(id, locationId, user.id);

        return NextResponse.json({ success: true, data: sale });
    } catch (error: any) {
        const status = error.message?.includes('not found')
            ? 404
            : error.message?.includes('already been refunded')
              ? 400
              : 500;
              
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status },
        );
    }
}
