import { PERMISSIONS, requirePermission } from '@/service/core/authz';
import { getRequestContext } from '@/lib/request-context';
import { ApiError } from '@/service/core/api-response';
import { companyUserService } from '@/service/apps/base/user';
import {
    userIdSchema,
    updateUserSchema,
} from '@/service/schema/user.schema';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

type Params = { params: Promise<{ id: string }> };

// GET /api/setting/users/[id] — company-scoped detail.
export async function GET(request: NextRequest, { params }: Params) {
    try {
        const ctx = getRequestContext(request);
        await requirePermission(ctx, PERMISSIONS.setting.user.view, { req: request });
        const { id } = await params;
        const parsed = userIdSchema.safeParse({ id });
        if (!parsed.success) {
            return NextResponse.json({ error: 'Invalid user id' }, { status: 400 });
        }
        const user = await companyUserService.get(ctx, parsed.data.id);
        return NextResponse.json({ data: user }, { status: 200 });
    } catch (error) {
        if (error instanceof ApiError) return error.toResponse();
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// PATCH /api/setting/users/[id] — update profile fields and/or roles.
export async function PATCH(request: NextRequest, { params }: Params) {
    try {
        const ctx = getRequestContext(request);
        await requirePermission(ctx, PERMISSIONS.setting.user.update, { req: request });
        const { id } = await params;
        const idParsed = userIdSchema.safeParse({ id });
        if (!idParsed.success) {
            return NextResponse.json({ error: 'Invalid user id' }, { status: 400 });
        }
        const bodyParsed = updateUserSchema.safeParse(await request.json());
        if (!bodyParsed.success) {
            return NextResponse.json(
                { error: z.flattenError(bodyParsed.error).fieldErrors },
                { status: 422 },
            );
        }
        const user = await companyUserService.update(
            ctx,
            idParsed.data.id,
            bodyParsed.data,
        );
        return NextResponse.json({ data: user }, { status: 200 });
    } catch (error) {
        if (error instanceof ApiError) return error.toResponse();
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
