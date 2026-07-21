import { PERMISSIONS, requirePermission } from '@/service/core/authz';
import { createInventorySchema } from '@/service/schema/inventory.schema';
import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { ApiError, ApiResponseSuccess } from '@/service/core/api-response';
import { parseListParams, withDefaultFilters } from '@/service/core/query/http.ts';
import { z } from 'zod';
import { InventoryRepository } from '@/service/apps/inventory/repo/stock';

export const Service = InventoryRepository.getInstance();

export async function GET(req: NextRequest) {
    try {
        const ctx = getRequestContext(req);
        await requirePermission(ctx, PERMISSIONS.inventory.item.view, { req: req });
        let query = parseListParams(req);

        // Legacy picker param: Sales pickers (Cash Sale, Sales Order) ask for
        // sellable items only via ?sellable=true.
        if (req.nextUrl.searchParams.get('sellable') === 'true') {
            query = withDefaultFilters(query, [
                { field: 'is_sellable', operator: 'eq', value: 'true' },
            ]);
        }

        const result = await Service.findAllByClassV2(ctx, query, 'service');
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
        await requirePermission(ctx, PERMISSIONS.inventory.item.create, { req: req });
        const body = await req.json();

        const parsed = createInventorySchema.safeParse({ ...body, item_class: 'service' });
        if (!parsed.success) {
            return NextResponse.json(
                { error: z.flattenError(parsed.error).fieldErrors },
                { status: 422 },
            );
        }

        const item = await Service.insertOne(ctx, parsed.data);
        return NextResponse.json({ data: item }, { status: 201 });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        const status = message.includes('already exists') ? 409 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}
