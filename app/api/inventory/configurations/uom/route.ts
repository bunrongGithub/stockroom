import { createInventoryUomSchema } from '@/service/schema/inventory-uom.schema';
import { getRequestContext } from '@/lib/request-context';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { service } from '.';

export async function GET(req: NextRequest) {
    try {
        const ctx = getRequestContext(req);
        const sp = req.nextUrl.searchParams;

        const result = await service.findAll(ctx, {
            page: Number(sp.get('page') || 1),
            limit: Number(sp.get('limit') || 20),
            search: sp.get('search') ?? undefined,
            searchColumn: 'name',
        });

        return NextResponse.json(result, { status: 200 });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const ctx = getRequestContext(req);
        const body = await req.json();

        const parsed = createInventoryUomSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: z.flattenError(parsed.error).fieldErrors },
                { status: 422 },
            );
        }

        const item = await service.insertOne(ctx, parsed.data);
        return NextResponse.json({ data: item }, { status: 201 });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        const status = message.includes('already exists') ? 409 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}
