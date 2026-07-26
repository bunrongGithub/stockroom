import { PERMISSIONS, requirePermission } from '@/service/core/authz';
import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { SalesShipmentRepository } from '@/service/apps/sale/repo/shipment';
import { salesShipmentIdSchema } from '@/service/schema/sale-shipment.schema';
import { ApiError, ApiResponseSuccess } from '@/service/core/api-response';
import type { RequestParam } from '@/app/api/http';

const service = SalesShipmentRepository.getInstance();

export async function POST(req: NextRequest, { params }: RequestParam) {
    try {
        const ctx = getRequestContext(req);
        await requirePermission(ctx, PERMISSIONS.sales.shipment.void, { req: req });
        const { id } = await params;
        const idParsed = salesShipmentIdSchema.safeParse({ id });
        if (!idParsed.success) {
            return NextResponse.json({ error: 'Invalid shipment ID' }, { status: 400 });
        }
        const data = await service.voidOne(ctx, idParsed.data.id);
        return new ApiResponseSuccess({ data }, 'Success').toResponse();
    } catch (error) {
        if (error instanceof ApiError) return error.toResponse();
        const message =
            error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
