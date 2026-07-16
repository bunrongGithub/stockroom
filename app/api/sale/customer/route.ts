import { getRequestContext } from '@/lib/request-context';
import { CustomerRepository } from '@/service/apps/base/customer';
import { ApiError, ApiResponseSuccess } from '@/service/core/api-response';
import { parseListParams, withDefaultFilters } from '@/service/core/query/http.ts';
import { createCustomerSchema } from '@/service/schema/customer.schema';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const service = CustomerRepository.getInstance();

/** Counter lookup: one search box, matched against name OR phone. */
export async function GET(req: NextRequest) {
    try {
        const ctx = getRequestContext(req);
        // Counter pickers only ever offer active customers — default to
        // active-only unless the caller filters is_active explicitly
        // (legacy ?active=false keeps returning everyone).
        let query = parseListParams(req);
        if (req.nextUrl.searchParams.get('active') !== 'false') {
            query = withDefaultFilters(query, [
                { field: 'is_active', operator: 'eq', value: 'true' },
            ]);
        }

        const result = await service.findAllV2(ctx, query);
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
