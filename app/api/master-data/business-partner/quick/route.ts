import { PERMISSIONS, requirePermission } from '@/service/core/authz';
import { getRequestContext } from '@/lib/request-context';
import { ApiError } from '@/service/core/api-response';
import { quickCreateBusinessPartnerSchema } from '@/service/schema/business-partner.schema';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Service } from '../route';

/**
 * The counter path: register a partner from name + phone alone, without
 * leaving the sale. An existing phone returns that partner instead of creating
 * a duplicate (`matched: true`), which is what keeps repeat customers to one
 * record no matter how often they come back.
 */
export async function POST(req: NextRequest) {
    try {
        const ctx = getRequestContext(req);
        await requirePermission(ctx, PERMISSIONS.masterData.partner.create, { req });
        const body = await req.json();

        const parsed = quickCreateBusinessPartnerSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: z.flattenError(parsed.error).fieldErrors },
                { status: 422 },
            );
        }

        const { partner, matched } = await Service.quickCreate(ctx, parsed.data);
        return NextResponse.json(
            { data: partner, matched },
            { status: matched ? 200 : 201 },
        );
    } catch (error) {
        if (error instanceof ApiError) return error.toResponse();
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
