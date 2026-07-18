import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { SerialManagementService } from '@/service/apps/inventory/serial';
import { generateSerialsSchema } from '@/service/schema/serial.schema';
import { ApiError, ApiResponseSuccess } from '@/service/core/api-response';

const service = SerialManagementService.getInstance();

// POST /api/inventory/serial/generate — { item_id, warehouse_id?, count }
// Returns generated serial strings (nothing persisted; the sequence block is
// consumed atomically so concurrent calls never overlap). Serials materialize
// when the receipt/adjustment is posted.
export async function POST(req: NextRequest) {
    try {
        const ctx = getRequestContext(req);
        const parsed = generateSerialsSchema.safeParse(await req.json());
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid request body' },
                { status: 400 },
            );
        }
        const data = await service.generate(ctx, {
            itemId: parsed.data.item_id,
            warehouseId: parsed.data.warehouse_id,
            count: parsed.data.count,
        });
        return new ApiResponseSuccess({ data }, 'Success').toResponse();
    } catch (error) {
        if (error instanceof ApiError) return error.toResponse();
        const message =
            error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
