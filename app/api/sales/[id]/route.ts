import { createClient } from '@/lib/supabase/server';
import { SaleService } from '@/lib/services/sale.service';
import { NextRequest, NextResponse } from 'next/server';

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/sales/[id] — Fetch a single sale
export async function GET(_req: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;
        const service = SaleService.getInstance();
        const sale = await service.getRawById(id);

        return NextResponse.json({ data: sale });
    } catch (error: any) {
        const status = error.message?.includes('not found') ? 404 : 500;
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status },
        );
    }
}

// PUT /api/sales/[id] — Update a sale
export async function PUT(req: NextRequest, { params }: RouteParams) {
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
        const service = SaleService.getInstance();
        const sale = await service.update(id, body);

        return NextResponse.json({ data: sale });
    } catch (error: any) {
        const status = error.message?.includes('not found') ? 404 : 500;
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status },
        );
    }
}

// DELETE /api/sales/[id] — Delete a sale
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const service = SaleService.getInstance();
        await service.delete(id);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        const status = error.message?.includes('not found') ? 404 : 500;
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status },
        );
    }
}
