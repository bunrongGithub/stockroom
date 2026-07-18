import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { SerialManagementService } from '@/service/apps/inventory/serial';
import { serialSearchSchema } from '@/service/schema/serial.schema';
import { ApiError, ApiResponseSuccess } from '@/service/core/api-response';

const service = SerialManagementService.getInstance();

// GET /api/inventory/serial/search?q=&status=&item_id=&warehouse_id=&location_id=&page=&limit=
// Paginated cross-status serial search with resolved item/warehouse/location
// names. One page at a time — designed for millions of serials.
export async function GET(req: NextRequest) {
    try {
        const ctx = getRequestContext(req);
        const parsed = serialSearchSchema.safeParse(
            Object.fromEntries(req.nextUrl.searchParams),
        );
        if (!parsed.success) {
            return NextResponse.json({ error: 'Invalid query' }, { status: 400 });
        }
        const { rows, meta } = await service.search(ctx, {
            q: parsed.data.q,
            status: parsed.data.status,
            itemId: parsed.data.item_id,
            warehouseId: parsed.data.warehouse_id,
            locationId: parsed.data.location_id,
            page: parsed.data.page,
            limit: parsed.data.limit,
        });
        return new ApiResponseSuccess({ data: rows, meta }, 'Success').toResponse();
    } catch (error) {
        if (error instanceof ApiError) return error.toResponse();
        const message =
            error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
