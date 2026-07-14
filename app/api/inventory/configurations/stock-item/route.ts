import { createInventorySchema } from '@/service/schema/inventory.schema';
import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { z } from 'zod';
import { InventoryRepository } from '@/service/apps/inventory/repo/stock';

export const Service = InventoryRepository.getInstance();
export async function GET(req: NextRequest) {
    try {
        const ctx = getRequestContext(req);
        const searchParams = req.nextUrl.searchParams;

        const page = Number(searchParams.get('page') || 1);
        const limit = Number(searchParams.get('limit') || 10);
        const search = searchParams.get('search') ?? undefined;

        const result = await Service.findAllByClass(ctx, {
            page,
            limit,
            search,
            searchColumn: 'name',
            // Sales pickers (Cash Sale, Sales Order) ask for sellable items only.
            sellableOnly: searchParams.get('sellable') === 'true',
        }, 'stock');

        return NextResponse.json(result, { status: 200 });
    } catch (error) {
        const message =
            error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const ctx = getRequestContext(req);
        const body = await req.json();

        const parsed = createInventorySchema.safeParse({ ...body, item_class: 'stock' });
        if (!parsed.success) {
            return NextResponse.json(
                { error: z.flattenError(parsed.error).fieldErrors },
                { status: 422 },
            );
        }

        const item = await Service.insertOne(ctx, parsed.data);
        return NextResponse.json({ data: item }, { status: 201 });
    } catch (error) {
        const message =
            error instanceof Error ? error.message : 'Unexpected error';
        const status = message.includes('already exists') ? 409 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}
