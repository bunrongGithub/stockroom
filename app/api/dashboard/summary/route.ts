import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { DashboardRepository } from '@/service/apps/dashboard/repo/summary';
import { ApiError, ApiResponseSuccess } from '@/service/core/api-response';

const service = DashboardRepository.getInstance();

// GET /api/dashboard/summary[?warehouse_id=] — the whole dashboard in one call.
export async function GET(req: NextRequest) {
    try {
        const ctx = getRequestContext(req);
        const warehouseId = Number(req.nextUrl.searchParams.get('warehouse_id'));
        const data = await service.getSummary(
            ctx,
            warehouseId > 0 ? warehouseId : undefined,
        );
        return new ApiResponseSuccess({ data }, 'Success').toResponse();
    } catch (error) {
        if (error instanceof ApiError) return error.toResponse();
        const message =
            error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
