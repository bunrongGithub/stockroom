import { getRequestContext } from '@/lib/request-context';
import { CustomerRepository } from '@/service/apps/base/customer';
import { ApiError, ApiResponseSuccess } from '@/service/core/api-response';
import { createCustomerSchema } from '@/service/schema/customer.schema';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const service = CustomerRepository.getInstance();

/** Counter lookup: one search box, matched against name OR phone. */
export async function GET(req: NextRequest) {
    try {
        const ctx = getRequestContext(req);
        const sp = req.nextUrl.searchParams;
        const result = await service.findAll(ctx, {
            page: Number(sp.get('page') || 1),
            limit: Number(sp.get('limit') || 10),
            search: sp.get('search') ?? undefined,
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
        const parsed = createCustomerSchema.safeParse(await req.json());
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
