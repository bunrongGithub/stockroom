import { getRequestContext } from '@/lib/request-context';
import { CompanySettingsRepository } from '@/service/apps/setting/repo/company-settings';
import { ApiError, ApiResponseSuccess } from '@/service/core/api-response';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const service = CompanySettingsRepository.getInstance();

const updateSalesSettingsSchema = z.object({
    default_sales_warehouse_id: z.number().int().positive().nullable().optional(),
    default_sales_location_id: z.number().int().positive().nullable().optional(),
});

/** Sales Settings — which warehouse/location counter sales ship from. */
export async function GET(req: NextRequest) {
    try {
        const ctx = getRequestContext(req);
        const data = await service.getSalesSettings(ctx);
        return new ApiResponseSuccess({ data }, 'Success').toResponse();
    } catch (error) {
        if (error instanceof ApiError) return error.toResponse();
        const message =
            error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    try {
        const ctx = getRequestContext(req);
        const parsed = updateSalesSettingsSchema.safeParse(await req.json());
        if (!parsed.success) {
            return NextResponse.json(
                { error: z.flattenError(parsed.error).fieldErrors },
                { status: 422 },
            );
        }
        const data = await service.updateSalesSettings(ctx, parsed.data);
        return new ApiResponseSuccess({ data }, 'Success').toResponse();
    } catch (error) {
        if (error instanceof ApiError) return error.toResponse();
        const message =
            error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
