import { PERMISSIONS, requirePermission } from '@/service/core/authz';
import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { SalesOrderRepository } from '@/service/apps/sale/repo/order';
import {
    updateSalesOrderSchema,
    salesOrderIdSchema,
} from '@/service/schema/sale-order.schema';
import {
    ApiError,
    ApiResponseSuccess,
    NotFoundError,
} from '@/service/core/api-response';
import type { RequestParam } from '@/app/api/http';

const service = SalesOrderRepository.getInstance();

export async function GET(req: NextRequest, { params }: RequestParam) {
    try {
        const ctx = getRequestContext(req);
        await requirePermission(ctx, PERMISSIONS.sales.order.view, { req: req });
        const { id } = await params;
        const idParsed = salesOrderIdSchema.safeParse({ id });
        if (!idParsed.success) {
            return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 });
        }
        const data = await service.findOne(ctx, idParsed.data.id);
        if (!data) throw new NotFoundError('Sales order not found');
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
        await requirePermission(ctx, PERMISSIONS.sales.order.update, { req: req });
        const { id } = await params;
        const body = await req.json();
        const idParsed = salesOrderIdSchema.safeParse({ id });
        if (!idParsed.success) {
            return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 });
        }
        const parsed = updateSalesOrderSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                {
                    error: 'Validation failed',
                    details: parsed.error.flatten().fieldErrors,
                },
                { status: 400 },
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
        await requirePermission(ctx, PERMISSIONS.sales.order.delete, { req: req });
        const { id } = await params;
        const idParsed = salesOrderIdSchema.safeParse({ id });
        if (!idParsed.success) {
            return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 });
        }
        await service.deleteOne(ctx, idParsed.data.id);
        return new ApiResponseSuccess({ data: { id: idParsed.data.id } }, 'Success').toResponse();
    } catch (error) {
        if (error instanceof ApiError) return error.toResponse();
        const message =
            error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
