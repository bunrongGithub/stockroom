import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { PERMISSIONS, requirePermission } from '@/service/core/authz';
import { StockAdjustmentRepository } from '@/service/apps/inventory/repo/adjustment';
import { ApiError, ApiResponseSuccess } from '@/service/core/api-response';

const service = StockAdjustmentRepository.getInstance();

// Active adjustment reasons — reusable configuration (DB rows, not code).
export async function GET(req: NextRequest) {
    try {
        const ctx = getRequestContext(req);
        await requirePermission(ctx, PERMISSIONS.inventory.adjustment.view, {
            req,
        });
        const data = await service.findReasons();
        return new ApiResponseSuccess({ data }, 'Success').toResponse();
    } catch (error) {
        if (error instanceof ApiError) return error.toResponse();
        const message =
            error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
