import { PERMISSIONS, requirePermission } from '@/service/core/authz';
import { branchCreateSchema } from '@/service/schema/branch.schema';
import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { WarehouseRepository } from '@/service/apps/inventory/repo/warehouse';
import { z } from 'zod';

export const service = WarehouseRepository.getInstance();

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const ctx = getRequestContext(request);
    await requirePermission(ctx, PERMISSIONS.inventory.warehouse.view, { req: request });

    const page = Number(searchParams.get('page') || 1);
    const limit = Number(searchParams.get('limit') || 10);
    const search = searchParams.get('search') ?? undefined;

    try {
        const items = await service.findAll(ctx, {
            page: page,
            limit: limit,
            search: search,
        });
        return NextResponse.json({ data: items }, { status: 200 });
    } catch (error) {
        const message =
            error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const ctx = getRequestContext(req);
        await requirePermission(ctx, PERMISSIONS.inventory.warehouse.create, { req: req });
        const body = await req.json();

        const parsed = branchCreateSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: z.flattenError(parsed.error).fieldErrors },
                { status: 422 },
            );
        }

        const item = await service.insertOne(ctx, parsed.data);
        return NextResponse.json({ data: item }, { status: 201 });
    } catch (error) {
        const message =
            error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
