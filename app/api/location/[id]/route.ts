import { idParamSchema } from '@/service/schema/branch.schema';
import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { service } from '..';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
    try {
        const ctx = getRequestContext(req);
        const { id } = await params;
        const parsed = idParamSchema.safeParse({ id });
        if (!parsed.success) {
            return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
        }
        const item = await service.findOne(ctx, parsed.data.id);
        if (!item) {
            return NextResponse.json({ error: 'Branch not found' }, { status: 404 });
        }
        return NextResponse.json({ data: item }, { status: 200 });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
