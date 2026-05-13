import { NextRequest, NextResponse } from 'next/server';
import { createCategorySchema } from '@/lib/validations/inventory-item-category.schema';
import {
    getAllItems,
    createItem,
} from '@/lib/services/inventory-item-category.service';

export async function GET() {
    try {
        const items = await getAllItems();
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

        const item = await createItem(parsed.data);
        return NextResponse.json({ data: item }, { status: 201 });
    } catch (error) {
        const message =
            error instanceof Error ? error.message : 'Unexpected error';
        const status = message.includes('already exists') ? 409 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}
