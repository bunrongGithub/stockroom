import { PERMISSIONS, requirePermission } from '@/service/core/authz';
import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { CustomerPaymentRepository } from '@/service/apps/sale/repo/payment';
import {
    updateCustomerPaymentSchema,
    customerPaymentIdSchema,
} from '@/service/schema/payment.schema';
import {
    ApiError,
    ApiResponseSuccess,
    NotFoundError,
} from '@/service/core/api-response';
import type { RequestParam } from '@/app/api/http';
import { z } from 'zod';

const service = CustomerPaymentRepository.getInstance();

export async function GET(req: NextRequest, { params }: RequestParam) {
    try {
        const ctx = getRequestContext(req);
        await requirePermission(ctx, PERMISSIONS.sales.payment.view, { req: req });
        const { id } = await params;
        const idParsed = customerPaymentIdSchema.safeParse({ id });
        if (!idParsed.success) {
            return NextResponse.json({ error: 'Invalid payment ID' }, { status: 400 });
        }
        const data = await service.findOne(ctx, idParsed.data.id);
        if (!data) throw new NotFoundError('Payment not found');
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
        await requirePermission(ctx, PERMISSIONS.sales.payment.update, { req: req });
        const { id } = await params;
        const idParsed = customerPaymentIdSchema.safeParse({ id });
        if (!idParsed.success) {
            return NextResponse.json({ error: 'Invalid payment ID' }, { status: 400 });
        }
        const parsed = updateCustomerPaymentSchema.safeParse(await req.json());
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
        await requirePermission(ctx, PERMISSIONS.sales.payment.delete, { req: req });
        const { id } = await params;
        const idParsed = customerPaymentIdSchema.safeParse({ id });
        if (!idParsed.success) {
            return NextResponse.json({ error: 'Invalid payment ID' }, { status: 400 });
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
