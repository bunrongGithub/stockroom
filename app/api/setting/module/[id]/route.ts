import { getRequestContext } from '@/lib/request-context';
import { idParamSchema } from '@/service/schema/branch.schema';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { service } from '..';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const ctx = getRequestContext(request);
        const { id } = await params;
        const idParsed = idParamSchema.safeParse({ id });
        if (!idParsed.success) {
            return NextResponse.json({ error: 'Invalid request params' }, { status: 400 });
        }
        const moduleDetail = await service.findOne(ctx, idParsed.data.id);
        if (!moduleDetail) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }
        return NextResponse.json({ data: moduleDetail }, { status: 200 });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

const updateModuleSchema = z.object({
    label: z.string().min(1, 'Label is required').trim().optional(),
    key: z.string().min(1, 'Key is required').trim().optional(),
    path: z.string().min(1, 'Path is required').trim().optional(),
    component: z.string().min(1, 'Component is required').trim().optional(),
    parent_id: z.number().int().positive().nullable().optional(),
    icon: z.string().trim().nullable().optional(),
    sort_order: z.number().int().min(0).optional(),
    type: z.enum(['transaction', 'configuration', 'action']).optional(),
    is_active: z.boolean().optional(),
    is_initial_data: z.boolean().optional(),
});

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const ctx = getRequestContext(request);
        const { id } = await params;
        const idParsed = idParamSchema.safeParse({ id });
        if (!idParsed.success) {
            return NextResponse.json({ error: 'Invalid request params' }, { status: 400 });
        }
        const body = await request.json();
        const parsed = updateModuleSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: z.flattenError(parsed.error).fieldErrors }, { status: 422 });
        }
        const item = await service.updateOne(ctx, idParsed.data.id, parsed.data);
        return NextResponse.json({ data: item }, { status: 200 });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const ctx = getRequestContext(request);
        const { id } = await params;
        const idParsed = idParamSchema.safeParse({ id });
        if (!idParsed.success) {
            return NextResponse.json({ error: 'Invalid request params' }, { status: 400 });
        }
        await service.deleteOne(ctx, idParsed.data.id);
        return new NextResponse(null, { status: 204 });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
