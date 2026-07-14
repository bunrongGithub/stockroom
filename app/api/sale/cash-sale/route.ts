import { getRequestContext } from '@/lib/request-context';
import { CashSaleService } from '@/service/apps/sale/cash-sale';
import { SalesOrderRepository } from '@/service/apps/sale/repo/order';
import { ApiError, ApiResponseSuccess } from '@/service/core/api-response';
import { cashSaleSchema } from '@/service/schema/cash-sale.schema';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const service = CashSaleService.getInstance();
const orders = SalesOrderRepository.getInstance();

/** Completed counter sales (they are sales orders on the cash_sale channel). */
export async function GET(req: NextRequest) {
    try {
        const ctx = getRequestContext(req);
        const sp = req.nextUrl.searchParams;
        const result = await orders.findAll(ctx, {
            page: Number(sp.get('page') || 1),
            limit: Number(sp.get('limit') || 10),
            search: sp.get('search') ?? undefined,
            sourceChannel: 'cash_sale',
        });
        return new ApiResponseSuccess(result, 'Success').toResponse();
    } catch (error) {
        if (error instanceof ApiError) return error.toResponse();
        const message =
            error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

/**
 * Complete a sale: order → shipment → posted stock → invoice → payment, or
 * nothing at all. The service compensates every applied step on failure.
 */
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
        const data = await service.complete(ctx, parsed.data);
        return new ApiResponseSuccess({ data }, 'Created', 201).toResponse();
    } catch (error) {
        if (error instanceof ApiError) return error.toResponse();
        const message =
            error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
