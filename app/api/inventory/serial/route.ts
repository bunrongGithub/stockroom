import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { InventorySerialRepository } from '@/service/apps/inventory/repo/serial';
import { ApiError, ApiResponseSuccess } from '@/service/core/api-response';

const service = InventorySerialRepository.getInstance();

// GET /api/inventory/serial?item_id=&warehouse_id=&location_id=[&status=available]
// Returns the AVAILABLE serials for an item in a specific warehouse+location —
// used by the Sales "select serial numbers" picker.
export async function GET(req: NextRequest) {
    try {
        const ctx = getRequestContext(req);
        const sp = req.nextUrl.searchParams;

        const itemId = Number(sp.get('item_id'));
        const warehouseId = Number(sp.get('warehouse_id'));
        const locationId = Number(sp.get('location_id'));

        if (!itemId || !warehouseId || !locationId) {
            return NextResponse.json({ data: [] }, { status: 200 });
        }

        const data = await service.findAvailable(ctx, {
            itemId,
            warehouseId,
            locationId,
        });
        return new ApiResponseSuccess({ data }, 'Success').toResponse();
    } catch (error) {
        if (error instanceof ApiError) return error.toResponse();
        const message =
            error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
