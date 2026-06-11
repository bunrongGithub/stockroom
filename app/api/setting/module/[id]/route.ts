import { getRequestContext } from '@/lib/request-context';
import { idParamSchema } from '@/service/schema/branch.schema';
import { NextRequest, NextResponse } from 'next/server';
import { service } from '..';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const ctx = getRequestContext(request);
    const { id } = await params;
    const idParsed = idParamSchema.safeParse({ id });
    if (!idParsed.success) {
        return NextResponse.json({ error: 'Invalid request params' });
    }
    const moduleDetail = await service.findOne(ctx, idParsed.data.id);
    return NextResponse.json({ data: moduleDetail }, { status: 200 });
}
