import { createInventoryUomSchema } from '@/service/schema/inventory-uom.schema';
import { getRequestContext } from '@/lib/request-context';
import { ApiError, ApiResponseSuccess } from '@/service/core/api-response';
import { parseListParams } from '@/service/core/query/http.ts';
import type { QueryObject } from '@/service/core/query/types.ts';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { service } from '.';

/**
 * Legacy wire params → Query Framework, so pre-framework callers
 * (?sortBy=name&sortOrder=desc&status=active) keep working unchanged.
 */
function mapLegacyParams(query: QueryObject, sp: URLSearchParams): QueryObject {
    const mapped = { ...query, filters: [...query.filters] };

    const sortBy = sp.get('sortBy');
    if (mapped.sort.length === 0 && sortBy) {
        mapped.sort = [
            {
                field: sortBy,
                direction: sp.get('sortOrder') === 'desc' ? 'desc' : 'asc',
            },
        ];
    }

    const hasActiveFilter = mapped.filters.some((f) => f.field === 'is_active');
    if (!hasActiveFilter && sp.get('status') === 'active') {
        mapped.filters.push({ field: 'is_active', operator: 'eq', value: 'true' });
    }

    return mapped;
}

export async function GET(req: NextRequest) {
    try {
        const ctx = getRequestContext(req);
        const query = mapLegacyParams(
            parseListParams(req),
            req.nextUrl.searchParams,
        );

        const result = await service.findAllV2(ctx, query);
        return new ApiResponseSuccess(result, 'Success').toResponse();
    } catch (error) {
        if (error instanceof ApiError) return error.toResponse();
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const ctx = getRequestContext(req);
        const body = await req.json();

        const parsed = createInventoryUomSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: z.flattenError(parsed.error).fieldErrors },
                { status: 422 },
            );
        }

        const item = await service.insertOne(ctx, parsed.data);
        return NextResponse.json({ data: item }, { status: 201 });
    } catch (error) {
        if (error instanceof ApiError) return error.toResponse();
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
