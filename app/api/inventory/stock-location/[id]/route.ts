import { PERMISSIONS, requirePermission } from '@/service/core/authz';
import { idParamSchema, stockLocationUpdateSchema } from '@/service/schema/branch.schema';
import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { StockLocationRepository } from '@/service/apps/inventory/repo/location';
import { z } from 'zod';

const service = StockLocationRepository.getInstance();

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
    try {
        const ctx = getRequestContext(req);
        await requirePermission(ctx, PERMISSIONS.inventory.warehouse.update, { req: req });
        const { id } = await params;
        const idParsed = idParamSchema.safeParse({ id });
        if (!idParsed.success) {
            return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
        }

        const body = await req.json();
        const parsed = stockLocationUpdateSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: z.flattenError(parsed.error).fieldErrors },
                { status: 422 },
            );
        }

        const item = await service.updateOne(ctx, idParsed.data.id, parsed.data);
        return NextResponse.json({ data: item }, { status: 200 });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        const status = message.includes('not found') ? 404 : message.includes('denied') ? 403 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}

export async function DELETE(req: NextRequest, { params }: Params) {
    try {
        const ctx = getRequestContext(req);
        await requirePermission(ctx, PERMISSIONS.inventory.warehouse.delete, { req: req });
        const { id } = await params;
        const idParsed = idParamSchema.safeParse({ id });
        if (!idParsed.success) {
            return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
        }

        await service.deleteOne(ctx, idParsed.data.id);
        return NextResponse.json({ message: 'Location deleted successfully' }, { status: 200 });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        const status = message.includes('stock') ? 409 : message.includes('denied') ? 403 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}
