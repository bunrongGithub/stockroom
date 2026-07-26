import { PERMISSIONS, requirePermission } from '@/service/core/authz';
import { getRequestContext } from '@/lib/request-context';
import { ApiError } from '@/service/core/api-response';
import { businessPartnerIdSchema } from '@/service/schema/business-partner.schema';
import { NextRequest, NextResponse } from 'next/server';
import { Service } from '../../route';

/** Overview tiles for the partner profile: lifetime sales, outstanding, AOV… */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const ctx = getRequestContext(req);
        await requirePermission(ctx, PERMISSIONS.masterData.partner.view, { req });
        const parsed = businessPartnerIdSchema.safeParse({ id: (await params).id });
        if (!parsed.success) {
            return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
        }

        const summary = await Service.summary(ctx, parsed.data.id);
        return NextResponse.json({ data: summary }, { status: 200 });
    } catch (error) {
        if (error instanceof ApiError) return error.toResponse();
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
