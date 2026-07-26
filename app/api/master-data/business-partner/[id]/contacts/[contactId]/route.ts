import { PERMISSIONS, requirePermission } from '@/service/core/authz';
import { getRequestContext } from '@/lib/request-context';
import { ApiError } from '@/service/core/api-response';
import { businessPartnerContactSchema } from '@/service/schema/business-partner.schema';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Service } from '../../../route';

type Params = { params: Promise<{ id: string; contactId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
    try {
        const ctx = getRequestContext(req);
        await requirePermission(ctx, PERMISSIONS.masterData.partner.update, { req });
        const { id, contactId } = await params;

        const bodyParsed = businessPartnerContactSchema
            .partial()
            .safeParse(await req.json());
        if (!bodyParsed.success) {
            return NextResponse.json(
                { error: z.flattenError(bodyParsed.error).fieldErrors },
                { status: 422 },
            );
        }

        const data = await Service.updateContact(
            ctx,
            Number(id),
            Number(contactId),
            bodyParsed.data,
        );
        return NextResponse.json({ data }, { status: 200 });
    } catch (error) {
        if (error instanceof ApiError) return error.toResponse();
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params }: Params) {
    try {
        const ctx = getRequestContext(req);
        await requirePermission(ctx, PERMISSIONS.masterData.partner.update, { req });
        const { id, contactId } = await params;
        await Service.deleteContact(ctx, Number(id), Number(contactId));
        return NextResponse.json({ message: 'Contact deleted' }, { status: 200 });
    } catch (error) {
        if (error instanceof ApiError) return error.toResponse();
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
