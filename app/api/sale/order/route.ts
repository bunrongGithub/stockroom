import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { SalesOrderRepository } from '@/service/apps/sale/repo/order';
import { createSalesOrderSchema } from '@/service/schema/sale-order.schema';
import { ApiError, ApiResponseSuccess } from '@/service/core/api-response';
import { z } from 'zod';

export const service = SalesOrderRepository.getInstance();

export async function GET(req: NextRequest) {
    try {
        const ctx = getRequestContext(req);
        const sp = req.nextUrl.searchParams;
        const result = await service.findAll(ctx, {
            page: Number(sp.get('page') || 1),
            limit: Number(sp.get('limit') || 10),
            search: sp.get('search') ?? undefined,
            searchColumn: 'order_no',
        });
        return new ApiResponseSuccess(result, 'Success').toResponse();
    } catch (error) {
        if (error instanceof ApiError) return error.toResponse();
        const message =
            error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const ctx = getRequestContext(req);
        const body = await req.json();
        const parsed = createSalesOrderSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: z.flattenError(parsed.error).fieldErrors },
                { status: 422 },
            );
        }
        const data = await service.insertOne(ctx, parsed.data);
        return new ApiResponseSuccess({ data }, 'Created', 201).toResponse();
    } catch (error) {
        if (error instanceof ApiError) return error.toResponse();
        const message =
            error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
