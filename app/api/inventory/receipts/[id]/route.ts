import { PERMISSIONS, requirePermission } from '@/service/core/authz';
import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { ReceiptRepository } from '@/service/apps/inventory/repo/receipt';
import {
    updateReceiptSchema,
    receiptIdSchema,
} from '@/service/schema/receipt.schema';
import { ApiError, ApiResponseSuccess } from '@/service/core/api-response';
import type { RequestParam } from '@/app/api/http';

export const service = ReceiptRepository.getInstance();

export async function PATCH(req: NextRequest, { params }: RequestParam) {
    try {
        const ctx = getRequestContext(req);
        await requirePermission(ctx, PERMISSIONS.inventory.receipt.update, { req: req });
        const { id } = await params;
        const body = await req.json();

        const idParsed = receiptIdSchema.safeParse({ id });
        if (!idParsed.success) {
            return NextResponse.json(
                { error: 'Invalid receipt ID' },
                { status: 400 },
            );
        }

        const parsed = updateReceiptSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                {
                    error: 'Validation failed',
                    details: parsed.error.flatten().fieldErrors,
                },
                { status: 400 },
            );
        }

        const data = await service.updateOne(
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
