import { PERMISSIONS, requirePermission } from '@/service/core/authz';
import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { SerialManagementService } from '@/service/apps/inventory/serial';
import { validateSerialsSchema } from '@/service/schema/serial.schema';
import { ApiError, ApiResponseSuccess } from '@/service/core/api-response';

const service = SerialManagementService.getInstance();

// POST /api/inventory/serial/validate — batch verdicts before posting.
// mode 'new' = serials being created; mode 'allocate' = existing serials
// being consumed (must match item/warehouse/location and be available).
export async function POST(req: NextRequest) {
    try {
        const ctx = getRequestContext(req);
        await requirePermission(ctx, PERMISSIONS.inventory.item.view, { req: req });
        const parsed = validateSerialsSchema.safeParse(await req.json());
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid request body' },
                { status: 400 },
            );
        }
        const data = await service.validate(ctx, {
            itemId: parsed.data.item_id,
            serials: parsed.data.serials,
            mode: parsed.data.mode,
            warehouseId: parsed.data.warehouse_id,
            locationId: parsed.data.location_id,
        });
        return new ApiResponseSuccess({ data }, 'Success').toResponse();
    } catch (error) {
        if (error instanceof ApiError) return error.toResponse();
        const message =
            error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
