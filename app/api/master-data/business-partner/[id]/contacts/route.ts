import { PERMISSIONS, requirePermission } from '@/service/core/authz';
import { getRequestContext } from '@/lib/request-context';
import { ApiError } from '@/service/core/api-response';
import {
    businessPartnerContactSchema,
    businessPartnerIdSchema,
} from '@/service/schema/business-partner.schema';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Service } from '../../route';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
    try {
        const ctx = getRequestContext(req);
        await requirePermission(ctx, PERMISSIONS.masterData.partner.view, { req });
        const parsed = businessPartnerIdSchema.safeParse({ id: (await params).id });
        if (!parsed.success) {
            return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
        }
        const data = await Service.listContacts(ctx, parsed.data.id);
        return NextResponse.json({ data }, { status: 200 });
    } catch (error) {
        if (error instanceof ApiError) return error.toResponse();
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function POST(req: NextRequest, { params }: Params) {
    try {
        const ctx = getRequestContext(req);
        await requirePermission(ctx, PERMISSIONS.masterData.partner.update, { req });
        const parsed = businessPartnerIdSchema.safeParse({ id: (await params).id });
        if (!parsed.success) {
            return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
        }

        const bodyParsed = businessPartnerContactSchema.safeParse(await req.json());
        if (!bodyParsed.success) {
            return NextResponse.json(
                { error: z.flattenError(bodyParsed.error).fieldErrors },
                { status: 422 },
            );
        }

        const data = await Service.addContact(ctx, parsed.data.id, bodyParsed.data);
        return NextResponse.json({ data }, { status: 201 });
    } catch (error) {
        if (error instanceof ApiError) return error.toResponse();
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
