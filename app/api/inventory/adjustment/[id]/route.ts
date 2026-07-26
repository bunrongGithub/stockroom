import { PERMISSIONS, requirePermission } from '@/service/core/authz';
import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { StockAdjustmentRepository } from '@/service/apps/inventory/repo/adjustment';
import {
    updateStockAdjustmentSchema,
    stockAdjustmentIdSchema,
} from '@/service/schema/adjustment.schema';
import {
    ApiError,
    ApiResponseSuccess,
    NotFoundError,
} from '@/service/core/api-response';
import type { RequestParam } from '@/app/api/http';
import { z } from 'zod';

const service = StockAdjustmentRepository.getInstance();

export async function GET(req: NextRequest, { params }: RequestParam) {
    try {
        const ctx = getRequestContext(req);
        await requirePermission(ctx, PERMISSIONS.inventory.adjustment.view, { req: req });
        const { id } = await params;
        const idParsed = stockAdjustmentIdSchema.safeParse({ id });
        if (!idParsed.success) {
            return NextResponse.json({ error: 'Invalid adjustment ID' }, { status: 400 });
        }
        const data = await service.findOne(ctx, idParsed.data.id);
        if (!data) throw new NotFoundError('Adjustment not found');
        return new ApiResponseSuccess({ data }, 'Success').toResponse();
    } catch (error) {
        if (error instanceof ApiError) return error.toResponse();
        const message =
            error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest, { params }: RequestParam) {
    try {
        const ctx = getRequestContext(req);
        await requirePermission(ctx, PERMISSIONS.inventory.adjustment.update, { req: req });
        const { id } = await params;
        const idParsed = stockAdjustmentIdSchema.safeParse({ id });
        if (!idParsed.success) {
            return NextResponse.json({ error: 'Invalid adjustment ID' }, { status: 400 });
        }
        const parsed = updateStockAdjustmentSchema.safeParse(await req.json());
        if (!parsed.success) {
            return NextResponse.json(
                { error: z.flattenError(parsed.error).fieldErrors },
                { status: 422 },
            );
        }
        const data = await service.updateOne(ctx, idParsed.data.id, parsed.data);
        return new ApiResponseSuccess({ data }, 'Success').toResponse();
    } catch (error) {
        if (error instanceof ApiError) return error.toResponse();
        const message =
            error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params }: RequestParam) {
    try {
        const ctx = getRequestContext(req);
        await requirePermission(ctx, PERMISSIONS.inventory.adjustment.delete, { req: req });
        const { id } = await params;
        const idParsed = stockAdjustmentIdSchema.safeParse({ id });
        if (!idParsed.success) {
            return NextResponse.json({ error: 'Invalid adjustment ID' }, { status: 400 });
        }
        await service.deleteOne(ctx, idParsed.data.id);
        return new ApiResponseSuccess({ data: true }, 'Success').toResponse();
    } catch (error) {
        if (error instanceof ApiError) return error.toResponse();
        const message =
            error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
