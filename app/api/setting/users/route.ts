import { getRequestContext } from '@/lib/request-context';
import { assertRole } from '@/lib/auth';
import { ApiError } from '@/service/core/api-response';
import { companyUserService } from '@/service/apps/base/user';
import { createUserSchema } from '@/service/schema/user.schema';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// GET /api/setting/users — company-scoped list (search / status / pagination).
export async function GET(request: NextRequest) {
    try {
        const ctx = getRequestContext(request);
        const sp = request.nextUrl.searchParams;
        const data = await companyUserService.list(ctx, {
            page: Number(sp.get('page') || 1),
            limit: Number(sp.get('limit') || 20),
            search: sp.get('search') ?? undefined,
            status: sp.get('status') ?? undefined,
        });
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
        assertRole(ctx, 'admin');

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
