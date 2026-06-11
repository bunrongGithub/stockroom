import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { z } from 'zod';
import { service } from '.';

export async function GET(request: NextRequest) {
    try {
        const ctx = getRequestContext(request);
        const searchParams = request.nextUrl.searchParams;

        const page = Number(searchParams.get('page') || 1);
        const limit = Number(searchParams.get('limit') || 10);
        const search = searchParams.get('search') ?? undefined;

        const items = await service.findAll(ctx, {
            page,
            limit,
            search,
            searchColumn: 'label',
        });
        return NextResponse.json(items, { status: 200 });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

const createModuleSchema = z.object({
    label: z.string().min(1, 'Label is required').trim(),
    key: z.string().min(1, 'Key is required').trim(),
    path: z.string().min(1, 'Path is required').trim(),
    component: z.string().min(1, 'Component is required').trim(),
    parent_id: z.number().int().positive().nullable().optional(),
    icon: z.string().trim().nullable().optional(),
    sort_order: z.number().int().min(0).default(0),
    type: z.enum(['transaction', 'configuration', 'action']).default('transaction'),
    is_active: z.boolean().default(true),
    is_initial_data: z.boolean().default(false),
});

export async function POST(request: NextRequest) {
    try {
        const ctx = getRequestContext(request);
        const body = await request.json();
        const parsed = createModuleSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: z.flattenError(parsed.error).fieldErrors },
                { status: 422 },
            );
        }

        const item = await service.insertOne(ctx, {
            ...parsed.data,
            parent_id: parsed.data.parent_id ?? null,
            icon: parsed.data.icon ?? null,
        });
        return NextResponse.json({ data: item }, { status: 201 });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
