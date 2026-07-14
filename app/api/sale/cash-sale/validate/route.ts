import { getRequestContext } from '@/lib/request-context';
import { CashSaleService } from '@/service/apps/sale/cash-sale';
import { ApiError, ApiResponseSuccess } from '@/service/core/api-response';
import { cashSaleSchema } from '@/service/schema/cash-sale.schema';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const service = CashSaleService.getInstance();

/** Dry run: resolve prices/stock/serials and price the cart. Writes nothing. */
export async function POST(req: NextRequest) {
    try {
        const ctx = getRequestContext(req);
        const parsed = cashSaleSchema.safeParse(await req.json());
        if (!parsed.success) {
            return NextResponse.json(
                { error: z.flattenError(parsed.error).fieldErrors },
                { status: 422 },
            );
        }
        const data = await service.validate(ctx, parsed.data);
        return new ApiResponseSuccess({ data }, 'Success').toResponse();
    } catch (error) {
        if (error instanceof ApiError) return error.toResponse();
        const message =
            error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
