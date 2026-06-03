import { getRequestContext } from '@/lib/request-context';
import { service } from '../route';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
    try {
        const ctx = getRequestContext(req);
        const items = await service.lookupWarehouse(ctx);
        return NextResponse.json({ data: items }, { status: 200 });
    } catch (error) {
        const message =
            error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
