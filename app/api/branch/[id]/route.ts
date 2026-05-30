import { idParamSchema, branchUpdateSchema } from '@/service/schema/branch.schema';
import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { WarehouseRepository } from '@/service/apps/inventory/repo/warehouse';
import { z } from 'zod';

const service = WarehouseRepository.getInstance();

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
    try {
        const ctx = getRequestContext(req);
        const { id } = await params;
        const parsed = idParamSchema.safeParse({ id });
        if (!parsed.success) {
            return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
        }
        const item = await service.findOne(ctx, parsed.data.id);
        if (!item) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }
        return NextResponse.json({ data: item }, { status: 200 });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest, { params }: Params) {
    try {
        const ctx = getRequestContext(req);
        const { id } = await params;
        const parsed = idParamSchema.safeParse({ id });
        if (!parsed.success) {
            return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
        }

        const body = await req.json();
        const bodyParsed = branchUpdateSchema.safeParse(body);
        if (!bodyParsed.success) {
            return NextResponse.json(
                { error: z.flattenError(bodyParsed.error).fieldErrors },
                { status: 422 },
            );
        }

        const item = await service.updateOne(ctx, parsed.data.id, bodyParsed.data);
        return NextResponse.json({ data: item }, { status: 200 });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        const status = message.includes('not found') ? 404 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}

export async function DELETE(req: NextRequest, { params }: Params) {
    try {
        const ctx = getRequestContext(req);
        const { id } = await params;
        const parsed = idParamSchema.safeParse({ id });
        if (!parsed.success) {
            return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
        }

        await service.deleteOne(ctx, parsed.data.id);
        return NextResponse.json({ message: 'Branch deleted successfully' }, { status: 200 });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        const status = message.includes('stock on hand') ? 409 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}
