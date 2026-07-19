import { PERMISSIONS, requirePermission } from '@/service/core/authz';
import { itemIdSchema, updateUomSchema } from '@/service/schema/uom.schema';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getRequestContext } from '@/lib/request-context';
import { service } from '..';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
    try {
        const ctx = getRequestContext(req);
        await requirePermission(ctx, PERMISSIONS.inventory.item.view, { req: req });
        const { id } = await params;

        const parsed = itemIdSchema.safeParse({ id });
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid ID format' },
                { status: 400 },
            );
        }

        const item = await service.findOne(ctx, parsed.data.id);
        if (!item) {
            return NextResponse.json({ error: 'UOM not found' }, { status: 404 });
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
        await requirePermission(ctx, PERMISSIONS.inventory.item.update, { req: req });
        const { id } = await params;

        const parsed = itemIdSchema.safeParse({ id });
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid ID format' },
                { status: 400 },
            );
        }

        const body = await req.json();
        const bodyParsed = updateUomSchema.safeParse(body);
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
        const status = message.includes('not found')
            ? 404
            : message.includes('already exists')
              ? 409
              : 500;
        return NextResponse.json({ error: message }, { status });
    }
}

// export async function DELETE(req: NextRequest, { params }: Params) {
//     try {
//         const ctx = getRequestContext(req);
//         const { id } = await params;

//         const parsed = itemIdSchema.safeParse({ id });
//         if (!parsed.success) {
//             return NextResponse.json(
//                 { error: 'Invalid ID format' },
//                 { status: 400 },
//             );
//         }

//         await service.deleteOne(ctx, parsed.data.id);
//         return NextResponse.json(
//             { message: 'UOM deleted successfully' },
//             { status: 200 },
//         );
//     } catch (error) {
//         const message = error instanceof Error ? error.message : 'Unexpected error';
//         return NextResponse.json({ error: message }, { status: 500 });
//     }
// }
