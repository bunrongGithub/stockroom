import { RequestParam } from '@/app/api/http';
import { getRequestContext } from '@/lib/request-context';
import { receiptIdSchema } from '@/service/schema/receipt.schema';
import { NextRequest, NextResponse } from 'next/server';
import { service } from '../route';
import {
    ApiError,
    ApiResponseSuccess,
    NotFoundError,
} from '@/service/core/api-response';

export async function GET(req: NextRequest, { params }: RequestParam) {
    try {
        const ctx = getRequestContext(req);
        const { id } = await params;
        const parsed = receiptIdSchema.safeParse({ id });

        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid receipt ID' },
                { status: 400 },
            );
        }

        const data = await service.findOne(ctx, parsed.data.id);
        if (!data) throw new NotFoundError('Receipt not found');

        return new ApiResponseSuccess({ data }, 'Success').toResponse();
    } catch (error) {
        if (error instanceof ApiError) return error.toResponse();
        const message =
            error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
