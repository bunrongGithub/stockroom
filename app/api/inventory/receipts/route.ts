import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { ReceiptRepository } from '@/service/apps/inventory/repo/receipt';
import { createReceiptSchema } from '@/service/schema/receipt.schema';
import { ApiError, ApiResponseSuccess } from '@/service/core/api-response';

const service = ReceiptRepository.getInstance();

export async function GET(req: NextRequest) {
    try {
        const ctx    = getRequestContext(req);
        const params = req.nextUrl.searchParams;

        const page   = Number(params.get('page')  || 1);
        const limit  = Number(params.get('limit') || 10);
        const search = params.get('search') ?? undefined;

        const result = await service.findAll(ctx, { page, limit, search, searchColumn: 'reference_no' });
        return new ApiResponseSuccess(result, 'Success').toResponse();
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const ctx    = getRequestContext(req);
        const body   = await req.json();
        const parsed = createReceiptSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
                { status: 400 },
            );
        }

        const data = await service.insertOne(ctx, parsed.data);
        return new ApiResponseSuccess({ data }, 'Created', 201).toResponse();
    } catch (error) {
        if (error instanceof ApiError) return error.toResponse();
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
