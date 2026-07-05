import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { StockAdjustmentRepository } from '@/service/apps/inventory/repo/adjustment';
import { ApiError, ApiResponseSuccess } from '@/service/core/api-response';

const service = StockAdjustmentRepository.getInstance();

// GET /api/inventory/adjustment/onhand?item_id=&warehouse_id=&location_id=
// Live on-hand quantity from inventory_balances (the movement engine's table)
// — powers the "Current Qty" display when adding an adjustment line.
export async function GET(req: NextRequest) {
    try {
        const ctx = getRequestContext(req);
        const sp = req.nextUrl.searchParams;
        const itemId = Number(sp.get('item_id'));
        const warehouseId = Number(sp.get('warehouse_id'));
        const locationId = Number(sp.get('location_id'));
        if (!itemId || !warehouseId || !locationId) {
            return NextResponse.json(
                { data: { qty_on_hand: 0 } },
                { status: 200 },
            );
        }
        const qty = await service.onHand(ctx, itemId, warehouseId, locationId);
        return new ApiResponseSuccess(
            { data: { qty_on_hand: qty } },
            'Success',
        ).toResponse();
    } catch (error) {
        if (error instanceof ApiError) return error.toResponse();
        const message =
            error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
