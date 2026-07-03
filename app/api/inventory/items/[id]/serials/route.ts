import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { InventorySerialRepository } from '@/service/apps/inventory/repo/serial';
import { ApiError, ApiResponseSuccess } from '@/service/core/api-response';
import type { RequestParam } from '@/app/api/http';

const service = InventorySerialRepository.getInstance();

// GET /api/inventory/items/:id/serials — all serials for an item (Item Detail tab).
export async function GET(req: NextRequest, { params }: RequestParam) {
    try {
        const ctx = getRequestContext(req);
        const { id } = await params;
        const itemId = Number(id);
        if (!itemId) {
            return NextResponse.json({ error: 'Invalid item ID' }, { status: 400 });
        }
        const data = await service.findByItem(ctx, itemId);
        return new ApiResponseSuccess({ data }, 'Success').toResponse();
    } catch (error) {
        if (error instanceof ApiError) return error.toResponse();
        const message =
            error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
