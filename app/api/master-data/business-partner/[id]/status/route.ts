import { PERMISSIONS, requirePermission } from '@/service/core/authz';
import { getRequestContext } from '@/lib/request-context';
import { ApiError } from '@/service/core/api-response';
import {
    businessPartnerIdSchema,
    partnerStatusSchema,
} from '@/service/schema/business-partner.schema';
import { NextRequest, NextResponse } from 'next/server';
import { Service } from '../../route';

type Params = { params: Promise<{ id: string }> };

/** Activate / deactivate. The safe alternative to deleting a referenced partner. */
export async function PATCH(req: NextRequest, { params }: Params) {
    try {
        const ctx = getRequestContext(req);
        await requirePermission(ctx, PERMISSIONS.masterData.partner.update, { req });
        const parsed = businessPartnerIdSchema.safeParse({ id: (await params).id });
        if (!parsed.success) {
            return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
        }

        const bodyParsed = partnerStatusSchema.safeParse(await req.json());
        if (!bodyParsed.success) {
            return NextResponse.json({ error: 'is_active is required' }, { status: 422 });
        }

        const partner = await Service.setStatus(
            ctx,
            parsed.data.id,
            bodyParsed.data.is_active,
        );
        return NextResponse.json({ data: partner }, { status: 200 });
    } catch (error) {
        if (error instanceof ApiError) return error.toResponse();
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
