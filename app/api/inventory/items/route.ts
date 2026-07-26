import { PERMISSIONS, requirePermission } from '@/service/core/authz';
import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { ApiError, ApiResponseSuccess } from '@/service/core/api-response';
import { parseListParams, withDefaultFilters } from '@/service/core/query/http.ts';
import { InventoryRepository } from '@/service/apps/inventory/repo/stock';

const Service = InventoryRepository.getInstance();

/**
 * Unified item lookup across ALL item classes (stock / non_stock / service).
 * This is the endpoint sale pickers and search dialogs use, so every sellable
 * item is offered regardless of class. Rows include `item_class` and
 * `track_serial` for behavior routing and badges.
 *
 *   ?sellable=true        → only is_sellable items (sales pickers)
 *   filter[item_class]=…  → optional class narrowing
 */
export async function GET(req: NextRequest) {
    try {
        const ctx = getRequestContext(req);
        await requirePermission(ctx, PERMISSIONS.inventory.item.view, { req: req });
        let query = parseListParams(req);

        if (req.nextUrl.searchParams.get('sellable') === 'true') {
            query = withDefaultFilters(query, [
                { field: 'is_sellable', operator: 'eq', value: 'true' },
            ]);
        }

        const result = await Service.findAllV2(ctx, query);
        return new ApiResponseSuccess(result, 'Success').toResponse();
    } catch (error) {
        if (error instanceof ApiError) return error.toResponse();
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
