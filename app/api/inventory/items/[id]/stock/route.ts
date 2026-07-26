import { PERMISSIONS, requirePermission } from '@/service/core/authz';
import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { InventoryBalanceRepository } from '@/service/apps/inventory/repo/inventory-balance';
import { itemIdSchema } from '@/service/schema/inventory.schema';
import { ApiError, ApiResponseSuccess } from '@/service/core/api-response';
import type { RequestParam } from '@/app/api/http';

const service = InventoryBalanceRepository.getInstance();

export async function GET(req: NextRequest, { params }: RequestParam) {
    try {
        const ctx = getRequestContext(req);
        await requirePermission(ctx, PERMISSIONS.inventory.item.view, { req: req });
        const { id } = await params;
        const parsed = itemIdSchema.safeParse({ id });

        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid item ID' },
                { status: 400 },
            );
        }

        const [data, summary] = await Promise.all([
            service.findByItem(ctx, parsed.data.id),
            service.summaryByItem(ctx, parsed.data.id),
        ]);

        return new ApiResponseSuccess({ data, summary }, 'Success').toResponse();
    } catch (error) {
        if (error instanceof ApiError) return error.toResponse();
        const message =
            error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
