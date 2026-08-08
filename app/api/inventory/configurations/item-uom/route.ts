import { PERMISSIONS, requirePermission } from '@/service/core/authz';
import { createItemUomSchema } from '@/service/schema/uom.schema';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getRequestContext } from '@/lib/request-context';
import { ApiError } from '@/service/core/api-response';
import { service } from '.';

/**
 * The UOMs defined for one item.
 *
 * Serves both the UOM Details editor and every transaction line picker, so the
 * payload carries the conversion plus the joined UOM master row — a picker must
 * be able to show "Box — 1 Box = 12 Piece" without a second request.
 */
export async function GET(request: NextRequest) {
    try {
        const ctx = getRequestContext(request);
        await requirePermission(ctx, PERMISSIONS.inventory.item.view, {
            req: request,
        });
        const searchParams = request.nextUrl.searchParams;

        const page = Number(searchParams.get('page') || 1);
        const limit = Number(searchParams.get('limit') || 10);
        const search = searchParams.get('search') ?? undefined;
        const itemId = Number(searchParams.get('item_id'));

        // UOMs are scoped to a product — without one there is nothing to list.
        if (!itemId) {
            return NextResponse.json(
                { data: [], meta: { total: 0, page, limit, totalPages: 0 } },
                { status: 200 },
            );
        }

        const items = await service.findAllByItem(ctx, itemId, {
            page,
            limit,
            search,
            searchColumn: 'name',
        });
        return NextResponse.json(items, { status: 200 });
    } catch (error) {
        if (error instanceof ApiError) return error.toResponse();
        const message =
            error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

/** Define an additional (non-base) UOM for an item. */
export async function POST(request: NextRequest) {
    try {
        const ctx = getRequestContext(request);
        await requirePermission(ctx, PERMISSIONS.inventory.item.create, {
            req: request,
        });

        const parsed = createItemUomSchema.safeParse(await request.json());
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
        const message =
            error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
