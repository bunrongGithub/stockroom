// import { getRequestContext } from '@/lib/request-context';
// import { StockBalanceRepository } from '@/service/apps/inventory/repo/stock-balance';
// import { itemIdSchema } from '@/service/schema/inventory.schema';
// import { NextRequest, NextResponse } from 'next/server';
// import { service } from '@/app/api/inventory/index';

import { NextRequest, NextResponse } from 'next/server';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
    // try {
    //     const ctx = getRequestContext(req);
    //     const { id } = await params;

    //     const parsed = itemIdSchema.safeParse({ id });
    //     if (!parsed.success) {
    //         return NextResponse.json({ error: 'Invalid item ID' }, { status: 400 });
    //     }

    //     // Verify the item belongs to this company before returning balances
    //     const item = await service.findOne(ctx, parsed.data.id);
    //     if (!item) {
    //         return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    //     }

    //     const data = await StockBalanceRepository.getInstance().findByItemId(
    //         ctx,
    //         parsed.data.id,
    //     );

    //     return NextResponse.json({ data }, { status: 200 });
    // } catch (error) {
    //     const message =
    //         error instanceof Error ? error.message : 'Unexpected error';
    //     return NextResponse.json({ error: message }, { status: 500 });
    // }

    return NextResponse.json(
        { message: 'This endpoint is currently disabled.' },
        { status: 503 },
    );
}
