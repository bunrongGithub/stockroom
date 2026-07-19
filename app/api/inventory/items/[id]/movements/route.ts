import { PERMISSIONS, requirePermission } from '@/service/core/authz';
import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { MovementRepository } from '@/service/apps/inventory/repo/movement';
import { itemIdSchema } from '@/service/schema/inventory.schema';
import { ApiError, ApiResponseSuccess } from '@/service/core/api-response';
import type { RequestParam } from '@/app/api/http';

const service = MovementRepository.getInstance();

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

        const data = await service.findItemLedger(ctx, parsed.data.id);
        return new ApiResponseSuccess({ data }, 'Success').toResponse();
    } catch (error) {
        if (error instanceof ApiError) return error.toResponse();
        const message =
            error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}