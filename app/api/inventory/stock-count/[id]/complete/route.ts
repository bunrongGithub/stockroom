import { PERMISSIONS, requirePermission } from '@/service/core/authz';
import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { StockCountRepository } from '@/service/apps/inventory/repo/stock-count';
import { stockCountIdSchema, submitStockCountSchema } from '@/service/schema/stock-count.schema';
import { ApiError, ApiResponseSuccess } from '@/service/core/api-response';
import type { RequestParam } from '@/app/api/http';
import { z } from 'zod';

const service = StockCountRepository.getInstance();

export async function POST(req: NextRequest, { params }: RequestParam) {
    try {
        const ctx = getRequestContext(req);
        await requirePermission(ctx, PERMISSIONS.inventory.stockCount.complete, { req: req });
        const { id } = await params;
        const idParsed = stockCountIdSchema.safeParse({ id });
        if (!idParsed.success) {
            return NextResponse.json(
                { error: 'Invalid stock count ID' },
                { status: 400 },
            );
        }
        const parsed = submitStockCountSchema.safeParse(await req.json());
        if (!parsed.success) {
            return NextResponse.json(
                { error: z.flattenError(parsed.error).fieldErrors },
                { status: 422 },
            );
        }
        const data = await service.complete(
            ctx,
            idParsed.data.id,
            parsed.data,
        );
        return new ApiResponseSuccess({ data }, 'Success').toResponse();
    } catch (error) {
        if (error instanceof ApiError) return error.toResponse();
        const message =
            error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
