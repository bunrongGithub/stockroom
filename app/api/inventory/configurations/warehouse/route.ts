import { stockLocationCreateSchema } from '@/service/schema/branch.schema';
import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { z } from 'zod';
import { WarehouseRepository } from '@/service/apps/inventory/repo/warehouse';
import { ApiResponseSuccess } from '@/service/core/api-response';

const service = WarehouseRepository.getInstance();

export async function GET(req: NextRequest) {
    try {
        const ctx = getRequestContext(req);

        const searchParams = req.nextUrl.searchParams;

        const page = Number(searchParams.get('page') || 1);
        const limit = Number(searchParams.get('limit') || 10);
        const search = searchParams.get('search') ?? undefined;

        const warehouses = await service.findAll(ctx, {
            page,
            limit,
            search,
            searchColumn: 'name',
        });
        return new ApiResponseSuccess(warehouses, 'Success', 200).toResponse();
    } catch (error) {
        const message =
            error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    // try {
    //     const ctx = getRequestContext(req);
    //     const body = await req.json();
    //     const parsed = stockLocationCreateSchema.safeParse(body);
    //     if (!parsed.success) {
    //         return NextResponse.json(
    //             { error: z.flattenError(parsed.error).fieldErrors },
    //             { status: 422 },
    //         );
    //     }
    //     const item = await service.insertOne(ctx, parsed.data);
    //     return NextResponse.json({ data: item }, { status: 201 });
    // } catch (error) {
    //     const message =
    //         error instanceof Error ? error.message : 'Unexpected error';
    //     return NextResponse.json({ error: message }, { status: 500 });
    // }
}
