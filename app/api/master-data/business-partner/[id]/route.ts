import { PERMISSIONS, requirePermission } from '@/service/core/authz';
import { getRequestContext } from '@/lib/request-context';
import { ApiError } from '@/service/core/api-response';
import {
    businessPartnerIdSchema,
    updateBusinessPartnerSchema,
} from '@/service/schema/business-partner.schema';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Service } from '../route';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
    try {
        const ctx = getRequestContext(req);
        await requirePermission(ctx, PERMISSIONS.masterData.partner.view, { req });
        const parsed = businessPartnerIdSchema.safeParse({ id: (await params).id });
        if (!parsed.success) {
            return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
        }

        const partner = await Service.findOne(ctx, parsed.data.id);
        if (!partner) {
            return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
        }
        return NextResponse.json({ data: partner }, { status: 200 });
    } catch (error) {
        if (error instanceof ApiError) return error.toResponse();
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest, { params }: Params) {
    try {
        const ctx = getRequestContext(req);
        await requirePermission(ctx, PERMISSIONS.masterData.partner.update, { req });
        const parsed = businessPartnerIdSchema.safeParse({ id: (await params).id });
        if (!parsed.success) {
            return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
        }

        const body = await req.json();
        // `code` is never accepted: identity is permanent by design.
        const bodyParsed = updateBusinessPartnerSchema.safeParse(body);
        if (!bodyParsed.success) {
            return NextResponse.json(
                { error: z.flattenError(bodyParsed.error).fieldErrors },
                { status: 422 },
            );
        }

        const partner = await Service.updateOne(ctx, parsed.data.id, bodyParsed.data);
        return NextResponse.json({ data: partner }, { status: 200 });
    } catch (error) {
        if (error instanceof ApiError) return error.toResponse();
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params }: Params) {
    try {
        const ctx = getRequestContext(req);
        await requirePermission(ctx, PERMISSIONS.masterData.partner.delete, { req });
        const parsed = businessPartnerIdSchema.safeParse({ id: (await params).id });
        if (!parsed.success) {
            return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
        }

        // Refuses while documents reference the partner — deactivate instead.
        await Service.deleteOne(ctx, parsed.data.id);
        return NextResponse.json({ message: 'Partner deleted' }, { status: 200 });
    } catch (error) {
        if (error instanceof ApiError) return error.toResponse();
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
