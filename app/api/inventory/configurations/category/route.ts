import { PERMISSIONS, requirePermission } from '@/service/core/authz';
import { getRequestContext } from '@/lib/request-context';
import { NextRequest, NextResponse } from 'next/server';
import { service } from '.';

export async function GET(request: NextRequest) {
    try {
        const ctx = getRequestContext(request);
        await requirePermission(ctx, PERMISSIONS.inventory.category.view, { req: request });
        const searchParams = request.nextUrl.searchParams;

        const page = Number(searchParams.get('page') || 1);
        const limit = Number(searchParams.get('limit') || 10);
        const search = searchParams.get('search') ?? undefined;

        const items = await service.findAll(ctx, {
            page,
            limit,
            search,
            searchColumn: 'name',
        });
        return NextResponse.json(items, { status: 200 });
    } catch (error) {
        const message =
            error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
