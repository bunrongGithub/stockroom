import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { SerialManagementService } from '@/service/apps/inventory/serial';
import { ApiError, ApiResponseSuccess } from '@/service/core/api-response';
import type { RequestParam } from '@/app/api/http';

const service = SerialManagementService.getInstance();

// GET /api/inventory/serial/:id/history — append-only movement history for a serial.
export async function GET(req: NextRequest, { params }: RequestParam) {
    try {
        const ctx = getRequestContext(req);
        const { id } = await params;
        const serialId = Number(id);
        if (!serialId) {
            return NextResponse.json({ error: 'Invalid serial ID' }, { status: 400 });
        }
        const data = await service.findHistory(ctx, serialId);
        return new ApiResponseSuccess({ data }, 'Success').toResponse();
    } catch (error) {
        if (error instanceof ApiError) return error.toResponse();
        const message =
            error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
