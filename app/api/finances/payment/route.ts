import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { CustomerPaymentRepository } from '@/service/apps/sale/repo/payment';
import { createCustomerPaymentSchema } from '@/service/schema/payment.schema';
import { ApiError, ApiResponseSuccess } from '@/service/core/api-response';
import { parseListParams } from '@/service/core/query/http.ts';
import { z } from 'zod';

const service = CustomerPaymentRepository.getInstance();

export async function GET(req: NextRequest) {
    try {
        const ctx = getRequestContext(req);
        const result = await service.findAllV2(ctx, parseListParams(req));
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
        const parsed = createCustomerPaymentSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: z.flattenError(parsed.error).fieldErrors },
                { status: 422 },
            );
        }
        const data = await service.create(ctx, parsed.data);
        return new ApiResponseSuccess({ data }, 'Created', 201).toResponse();
    } catch (error) {
        if (error instanceof ApiError) return error.toResponse();
        const message =
            error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
