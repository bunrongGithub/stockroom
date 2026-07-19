import { PERMISSIONS, requirePermission } from '@/service/core/authz';
import { RequestParam } from '@/app/api/http';
import { getRequestContext } from '@/lib/request-context';
import { NextRequest, NextResponse } from 'next/server';
import { service } from '@/app/api/inventory/configurations/warehouse/route';
import { ApiError, NotFoundError } from '@/service/core/api-response';

export async function GET(request: NextRequest, { params }: RequestParam) {
    try {
        const context = getRequestContext(request);
        await requirePermission(context, PERMISSIONS.inventory.warehouse.view, { req: request });
        const { id } = await params;
        const warehouse = await service.findOne(context, parseInt(id));
        if (!warehouse) {
            return new NotFoundError('Warehouse not found').toResponse();
        }
        return NextResponse.json({ data: warehouse.warehouse_location ?? [] });
    } catch (error) {
        if (error instanceof ApiError) return error.toResponse();
        return NextResponse.json(
            { error: 'Unexpected error' },
            { status: 500 },
        );
    }
}
