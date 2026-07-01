import { createUomSchema } from '@/service/schema/uom.schema';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getRequestContext } from '@/lib/request-context';
import { service } from '.';

export async function GET(request: NextRequest) {
    try {
        const ctx = getRequestContext(request);
        const searchParams = request.nextUrl.searchParams;

        const page = Number(searchParams.get('page') || 1);
        const limit = Number(searchParams.get('limit') || 10);
        const search = searchParams.get('search') ?? undefined;
        const itemId = Number(searchParams.get('item_id'));

        // UOMs are scoped to a product — without one there is nothing to list.
        if (!itemId) {
            return NextResponse.json(
                { data: [], meta: { total: 0, page, limit, totalPages: 0 } },
                { status: 200 },
            );
        }

        const items = await service.findAllByItem(ctx, itemId, {
            page,
            limit,
            search,
            searchColumn: 'name',
        });
        return NextResponse.json(items, { status: 200 });
    } catch (error) {
        console.error('Error in GET /api/uom:', error);
        const message =
            error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// export async function POST(req: NextRequest) {
//     try {
//         const ctx = getRequestContext(req);
//         const body = await req.json();

//         const parsed = createUomSchema.safeParse(body);
//         if (!parsed.success) {
//             return NextResponse.json(
//                 { error: z.flattenError(parsed.error).fieldErrors },
//                 { status: 422 },
//             );
//         }

//         const item = await service.insertOne(ctx, parsed.data);
//         return NextResponse.json({ data: item }, { status: 201 });
//     } catch (error) {
//         const message =
//             error instanceof Error ? error.message : 'Unexpected error';
//         const status = message.includes('already exists') ? 409 : 500;
//         return NextResponse.json({ error: message }, { status });
//     }
// }
