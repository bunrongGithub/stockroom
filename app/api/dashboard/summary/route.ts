import { PERMISSIONS, requirePermission } from '@/service/core/authz';
import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { DashboardRepository } from '@/service/apps/dashboard/repo/summary';
import { ApiError, ApiResponseSuccess } from '@/service/core/api-response';

const service = DashboardRepository.getInstance();

// GET /api/dashboard/summary[?warehouse_id=] — the whole dashboard in one call.
export async function GET(req: NextRequest) {
    try {
        const ctx = getRequestContext(req);
        await requirePermission(ctx, PERMISSIONS.dashboard.view, { req: req });
        const warehouseId = Number(req.nextUrl.searchParams.get('warehouse_id'));
        const locationId = Number(req.nextUrl.searchParams.get('location_id'));
        const data = await service.getSummary(
            ctx,
            warehouseId > 0 ? warehouseId : undefined,
            locationId > 0 ? locationId : undefined,
        );
        return new ApiResponseSuccess({ data }, 'Success').toResponse();
    } catch (error) {
        if (error instanceof ApiError) return error.toResponse();
        const message =
            error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
