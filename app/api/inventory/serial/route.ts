import { PERMISSIONS, requirePermission } from '@/service/core/authz';
import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { SerialManagementService } from '@/service/apps/inventory/serial';
import { ApiError, ApiResponseSuccess } from '@/service/core/api-response';

const service = SerialManagementService.getInstance();

// GET /api/inventory/serial?item_id=&warehouse_id=&location_id=[&search=][&limit=]
// AVAILABLE serials for an item in a warehouse+location, server-side prefix
// search, limited (default 50, cap 200), FIFO order. Returns { data, total }
// so pickers can show "Showing X of N" without ever loading the full set.
export async function GET(req: NextRequest) {
    try {
        const ctx = getRequestContext(req);
        await requirePermission(ctx, PERMISSIONS.inventory.item.view, { req: req });
        const sp = req.nextUrl.searchParams;

        const itemId = Number(sp.get('item_id'));
        const warehouseId = Number(sp.get('warehouse_id'));
        const locationId = Number(sp.get('location_id'));

        if (!itemId || !warehouseId || !locationId) {
            return NextResponse.json({ data: [], total: 0 }, { status: 200 });
        }

        const { rows, total } = await service.findAvailable(ctx, {
            itemId,
            warehouseId,
            locationId,
            search: sp.get('search') ?? undefined,
            limit: Number(sp.get('limit')) || undefined,
        });
        return new ApiResponseSuccess({ data: rows, total }, 'Success').toResponse();
    } catch (error) {
        if (error instanceof ApiError) return error.toResponse();
        const message =
            error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
