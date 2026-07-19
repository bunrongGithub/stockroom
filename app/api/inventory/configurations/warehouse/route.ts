import { PERMISSIONS, requirePermission } from '@/service/core/authz';
import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { WarehouseRepository } from '@/service/apps/inventory/repo/warehouse';
import { ApiResponseSuccess } from '@/service/core/api-response';

export const service = WarehouseRepository.getInstance();

export async function GET(req: NextRequest) {
    try {
        const ctx = getRequestContext(req);
        await requirePermission(ctx, PERMISSIONS.inventory.warehouse.view, { req: req });

        const searchParams = req.nextUrl.searchParams;

        const page = Number(searchParams.get('page') || 1);
        const limit = Number(searchParams.get('limit') || 10);
        const search = searchParams.get('search') ?? undefined;

        const warehouses = await service.findAll(ctx, {
            page,
            limit,
            search,
            searchColumn: 'name',
        });
        return new ApiResponseSuccess(warehouses, 'Success', 200).toResponse();
    } catch (error) {
        const message =
            error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
