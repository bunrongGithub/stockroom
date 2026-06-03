import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { service } from './../index';

export async function GET(req: NextRequest) {
    try {
        const ctx = getRequestContext(req);
        const warehouseIdParam = req.nextUrl.searchParams.get('warehouse_id');
        const warehouseId = warehouseIdParam ? Number(warehouseIdParam) : undefined;
        const items = await service.lookupLocations(ctx, warehouseId);
        return NextResponse.json({ data: items }, { status: 200 });
    } catch (error) {
        const message =
            error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
