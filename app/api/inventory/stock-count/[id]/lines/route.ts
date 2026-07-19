import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { StockCountLineRepository } from '@/service/apps/inventory/repo/stock-count';
import {
    recordCountsSchema,
    stockCountIdSchema,
} from '@/service/schema/stock-count.schema';
import { ApiError, ApiResponseSuccess } from '@/service/core/api-response';
import { parseListParams } from '@/service/core/query/http.ts';
import type { RequestParam } from '@/app/api/http';
import { z } from 'zod';

const service = StockCountLineRepository.getInstance();

export async function GET(req: NextRequest, { params }: RequestParam) {
    try {
        const ctx = getRequestContext(req);
        const { id } = await params;
        const idParsed = stockCountIdSchema.safeParse({ id });
        if (!idParsed.success) {
            return NextResponse.json(
                { error: 'Invalid stock count ID' },
                { status: 400 },
            );
        }

        const query = parseListParams(req);
        // Friendly variance facet on top of the numeric filter:
        // ?variance=positive|negative|zero → variance_qty gt/lt/eq 0.
        const variance = req.nextUrl.searchParams.get('variance');
        if (variance === 'positive' || variance === 'negative' || variance === 'zero') {
            query.filters.push({
                field: 'variance_qty',
                operator:
                    variance === 'positive'
                        ? 'gt'
                        : variance === 'negative'
                          ? 'lt'
                          : 'eq',
                value: '0',
            });
        }

        const result = await service.findLinesV2(ctx, idParsed.data.id, query);
        return new ApiResponseSuccess(result, 'Success').toResponse();
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
        const { id } = await params;
        const idParsed = stockCountIdSchema.safeParse({ id });
        if (!idParsed.success) {
            return NextResponse.json(
                { error: 'Invalid stock count ID' },
                { status: 400 },
            );
        }
        const parsed = recordCountsSchema.safeParse(await req.json());
        if (!parsed.success) {
            return NextResponse.json(
                { error: z.flattenError(parsed.error).fieldErrors },
                { status: 422 },
            );
        }
        const data = await service.recordCounts(
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
