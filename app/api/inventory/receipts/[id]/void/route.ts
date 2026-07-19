import { PERMISSIONS, requirePermission } from '@/service/core/authz';
import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { ReceiptRepository } from '@/service/apps/inventory/repo/receipt';
import { receiptIdSchema } from '@/service/schema/receipt.schema';
import { ApiError, ApiResponseSuccess } from '@/service/core/api-response';
import type { RequestParam } from '@/app/api/http';

const service = ReceiptRepository.getInstance();

export async function POST(req: NextRequest, { params }: RequestParam) {
    try {
        const ctx    = getRequestContext(req);
        await requirePermission(ctx, PERMISSIONS.inventory.receipt.void, { req: req });
        const { id } = await params;
        const parsed = receiptIdSchema.safeParse({ id });

        if (!parsed.success) {
            return NextResponse.json({ error: 'Invalid receipt ID' }, { status: 400 });
        }

        await service.voidReceipt(ctx, parsed.data.id);

        return new ApiResponseSuccess(
            { receipt_id: parsed.data.id },
            'Success',
        ).toResponse();
    } catch (error) {
        if (error instanceof ApiError) return error.toResponse();
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
