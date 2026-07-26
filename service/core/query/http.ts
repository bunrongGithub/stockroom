/**
 * Route-side entry point for the Query Framework.
 *
 * Standardized list handlers do exactly this (thin-controller convention):
 *
 *     const ctx = getRequestContext(request);
 *     const query = parseListParams(request);
 *     const result = await service.findAllV2(ctx, query);
 *     return new ApiResponseSuccess(result, 'Success').toResponse();
 */

import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { ValidationError } from '../api-response';
import { QueryValidationError } from './errors.ts';
import { parseListQuery } from './parse.ts';
import type { FilterCondition, QueryObject } from './types.ts';

/**
 * Defense-in-depth over parse.ts: the wire params that reach the parser must
 * already look sane. parse.ts is permissive by design; this guard rejects
 * obviously hostile shapes (absurd numbers, oversized inputs) before any
 * registry validation runs.
 */
const wireSchema = z.object({
    page: z.coerce.number().int().min(1).max(1_000_000).optional(),
    limit: z.coerce.number().int().min(1).max(1_000).optional(),
    search: z.string().max(200).optional(),
    sort: z.string().max(200).optional(),
    fields: z.string().max(500).optional(),
    include: z.string().max(500).optional(),
});

/** Parse + sanity-check the standardized wire format from a request. */
export function parseListParams(request: NextRequest): QueryObject {
    const searchParams = request.nextUrl.searchParams;

    const wire = wireSchema.safeParse({
        page: searchParams.get('page') ?? undefined,
        limit: searchParams.get('limit') ?? undefined,
        search: searchParams.get('search') ?? undefined,
        sort: searchParams.get('sort') ?? undefined,
        fields: searchParams.get('fields') ?? undefined,
        include: searchParams.get('include') ?? undefined,
    });
    if (!wire.success) {
        throw new ValidationError(
            'Invalid query parameters',
            z.flattenError(wire.error).fieldErrors as Record<string, string[]>,
        );
    }

    return parseListQuery(searchParams);
}

/**
 * Merge server-decided conditions into a client query. Use in routes that pin
 * domain filters (e.g. sales orders always filter source_channel) — the
 * conditions ride in `forced` on the repository call, NOT here, when they
 * must skip registry validation. This helper is for overridable defaults:
 * the client's own filter on the same field wins.
 */
export function withDefaultFilters(
    query: QueryObject,
    defaults: FilterCondition[],
): QueryObject {
    const overridden = new Set(query.filters.map((filter) => filter.field));
    const merged = defaults.filter((filter) => !overridden.has(filter.field));
    return merged.length > 0
        ? { ...query, filters: [...merged, ...query.filters] }
        : query;
}

/** Convert a framework validation failure into the app's 400 ApiError. */
export function toValidationError(error: unknown): unknown {
    if (error instanceof QueryValidationError) {
        return new ValidationError(error.message, error.details);
    }
    return error;
}
