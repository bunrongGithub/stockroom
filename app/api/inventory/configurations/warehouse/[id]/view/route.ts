import { RequestParam } from '@/app/api/http';
import { getRequestContext } from '@/lib/request-context';
import { NextRequest, NextResponse } from 'next/server';
import { service } from '../../route';

export async function GET(request: NextRequest, { params }: RequestParam) {
    const context = getRequestContext(request);
    const { id } = await params;
    const warehouse = await service.findOne(context, parseInt(id));
    return NextResponse.json(warehouse);
}
