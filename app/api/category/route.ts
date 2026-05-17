import { createCategorySchema } from '@/lib/validations/category.schema';
import { NextRequest, NextResponse } from 'next/server';
import { service } from '.';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        console.log(searchParams);

        const page = Number(searchParams.get('page') || 1);
        const limit = Number(searchParams.get('limit') || 10);
        const search = searchParams.get('search');
        const items = await service.getAll({
            page: page,
            limit: limit,
            search: search!,
        });
        return NextResponse.json({ data: items }, { status: 200 });
    } catch (error) {
        const message =
            error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        const parsed = createCategorySchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error.flatten().fieldErrors },
                { status: 422 },
            );
        }

        const item = await service.create(parsed.data);
        return NextResponse.json({ data: item }, { status: 201 });
    } catch (error) {
        const message =
            error instanceof Error ? error.message : 'Unexpected error';
        const status = message.includes('already exists') ? 409 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}
