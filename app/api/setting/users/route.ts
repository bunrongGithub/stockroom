import { PERMISSIONS, requirePermission } from '@/service/core/authz';
import { getRequestContext } from '@/lib/request-context';
import { ApiError } from '@/service/core/api-response';
import { companyUserService } from '@/service/apps/base/user';
import { createUserSchema } from '@/service/schema/user.schema';
import { parseListParams } from '@/service/core/query/http';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// GET /api/setting/users — company-scoped list (Query Framework).
export async function GET(request: NextRequest) {
    try {
        const ctx = getRequestContext(request);
        await requirePermission(ctx, PERMISSIONS.setting.user.view, { req: request });
        const query = parseListParams(request);
        const data = await companyUserService.listV2(ctx, query);
        return NextResponse.json(data, { status: 200 });
    } catch (error) {
        if (error instanceof ApiError) return error.toResponse();
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// POST /api/setting/users — create a user into the caller's company.
export async function POST(request: NextRequest) {
    try {
        const ctx = getRequestContext(request);
        await requirePermission(ctx, PERMISSIONS.setting.user.create, { req: request });

        const parsed = createUserSchema.safeParse(await request.json());
        if (!parsed.success) {
            return NextResponse.json(
                { error: z.flattenError(parsed.error).fieldErrors },
                { status: 422 },
            );
        }

        const user = await companyUserService.create(ctx, parsed.data);
        return NextResponse.json({ data: user }, { status: 201 });
    } catch (error) {
        if (error instanceof ApiError) return error.toResponse();
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
