import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { SerialManagementService } from '@/service/apps/inventory/serial';
import { updateSerialConfigSchema } from '@/service/schema/serial.schema';
import { ApiError, ApiResponseSuccess } from '@/service/core/api-response';

const service = SerialManagementService.getInstance();

// GET /api/inventory/configurations/serial-setting — company serial config
// (created with defaults on first read).
export async function GET(req: NextRequest) {
    try {
        const ctx = getRequestContext(req);
        const data = await service.getConfig(ctx);
        return new ApiResponseSuccess({ data }, 'Success').toResponse();
    } catch (error) {
        if (error instanceof ApiError) return error.toResponse();
        const message =
            error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// PUT /api/inventory/configurations/serial-setting — update the config.
export async function PUT(req: NextRequest) {
    try {
        const ctx = getRequestContext(req);
        const parsed = updateSerialConfigSchema.safeParse(await req.json());
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid request body' },
                { status: 400 },
            );
        }
        const data = await service.updateConfig(ctx, parsed.data);
        return new ApiResponseSuccess({ data }, 'Success').toResponse();
    } catch (error) {
        if (error instanceof ApiError) return error.toResponse();
        const message =
            error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
