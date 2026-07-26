import { PERMISSIONS, requirePermission } from '@/service/core/authz';
import { getRequestContext } from '@/lib/request-context';
import { ApiError } from '@/service/core/api-response';
import { businessPartnerAddressSchema } from '@/service/schema/business-partner.schema';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Service } from '../../../route';

type Params = { params: Promise<{ id: string; addressId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
    try {
        const ctx = getRequestContext(req);
        await requirePermission(ctx, PERMISSIONS.masterData.partner.update, { req });
        const { id, addressId } = await params;

        const bodyParsed = businessPartnerAddressSchema
            .partial()
            .safeParse(await req.json());
        if (!bodyParsed.success) {
            return NextResponse.json(
                { error: z.flattenError(bodyParsed.error).fieldErrors },
                { status: 422 },
            );
        }

        const data = await Service.updateAddress(
            ctx,
            Number(id),
            Number(addressId),
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
        const { id, addressId } = await params;
        await Service.deleteAddress(ctx, Number(id), Number(addressId));
        return NextResponse.json({ message: 'Address deleted' }, { status: 200 });
    } catch (error) {
        if (error instanceof ApiError) return error.toResponse();
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
