import { PERMISSIONS, requirePermission } from '@/service/core/authz';
import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { SalesOrderRepository } from '@/service/apps/sale/repo/order';
import { salesOrderIdSchema } from '@/service/schema/sale-order.schema';
import { ApiError, ApiResponseSuccess } from '@/service/core/api-response';
import type { RequestParam } from '@/app/api/http';

const service = SalesOrderRepository.getInstance();

export async function PATCH(req: NextRequest, { params }: RequestParam) {
    try {
        const ctx = getRequestContext(req);
        await requirePermission(ctx, PERMISSIONS.sales.order.close, { req: req });
        const { id } = await params;
        const idParsed = salesOrderIdSchema.safeParse({ id });
        if (!idParsed.success) {
            return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 });
        }
        const data = await service.closeOne(ctx, idParsed.data.id);
        return new ApiResponseSuccess({ data }, 'Success').toResponse();
    } catch (error) {
        if (error instanceof ApiError) return error.toResponse();
        const message =
            error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
