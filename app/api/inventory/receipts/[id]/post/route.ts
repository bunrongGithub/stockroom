import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { ReceiptRepository } from '@/service/apps/inventory/repo/receipt';
import { receiptIdSchema } from '@/service/schema/receipt.schema';
import { ApiError, ApiResponseSuccess } from '@/service/core/api-response';
import type { RequestParam } from '@/app/api/http';

const service = ReceiptRepository.getInstance();

export async function POST(req: NextRequest, { params }: RequestParam) {
    try {
        const ctx = getRequestContext(req);
        const { id } = await params;

        const result = await service.postReceipt(ctx, parseInt(id));

        if (!result.ok) {
            return NextResponse.json({ error: result.error }, { status: 422 });
        }

        return new ApiResponseSuccess(
            { receipt_id: parseInt(id) },
            'Success',
        ).toResponse();
    } catch (error) {
        if (error instanceof ApiError) return error.toResponse();
        const message =
            error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
