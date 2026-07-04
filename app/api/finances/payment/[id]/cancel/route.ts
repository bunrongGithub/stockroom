import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { CustomerPaymentRepository } from '@/service/apps/sale/repo/payment';
import { customerPaymentIdSchema } from '@/service/schema/payment.schema';
import { ApiError, ApiResponseSuccess } from '@/service/core/api-response';
import type { RequestParam } from '@/app/api/http';

const service = CustomerPaymentRepository.getInstance();

export async function POST(req: NextRequest, { params }: RequestParam) {
    try {
        const ctx = getRequestContext(req);
        const { id } = await params;
        const idParsed = customerPaymentIdSchema.safeParse({ id });
        if (!idParsed.success) {
            return NextResponse.json({ error: 'Invalid payment ID' }, { status: 400 });
        }
        const data = await service.cancelOne(ctx, idParsed.data.id);
        return new ApiResponseSuccess({ data }, 'Success').toResponse();
    } catch (error) {
        if (error instanceof ApiError) return error.toResponse();
        const message =
            error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
