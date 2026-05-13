import { NextRequest, NextResponse } from 'next/server';
import {
    updateCategorySchema,
    itemIdSchema,
} from '@/lib/validations/inventory-item-category.schema';
import {
    getItemById,
    updateItem,
    deleteItem,
} from '@/lib/services/inventory-item-category.service';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
    try {
        const { id } = await params;

        const parsed = itemIdSchema.safeParse({ id });
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid ID format' },
                { status: 400 },
            );
        }

        const item = await getItemById(parsed.data.id);
        return NextResponse.json({ data: item }, { status: 200 });
    } catch (error) {
        const message =
            error instanceof Error ? error.message : 'Unexpected error';
        const status = message.includes('not found') ? 404 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}

export async function PATCH(req: NextRequest, { params }: Params) {
    try {
        const { id } = await params;

        const parsed = itemIdSchema.safeParse({ id });
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid ID format' },
                { status: 400 },
            );
        }

        const body = await req.json();
        const bodyParsed = updateCategorySchema.safeParse(body);
        if (!bodyParsed.success) {
            return NextResponse.json(
                { error: bodyParsed.error.flatten().fieldErrors },
                { status: 422 },
            );
        }

        const item = await updateItem(parsed.data.id, bodyParsed.data);
        return NextResponse.json({ data: item }, { status: 200 });
    } catch (error) {
        const message =
            error instanceof Error ? error.message : 'Unexpected error';
        const status = message.includes('not found')
            ? 404
            : message.includes('already exists')
              ? 409
              : 500;
        return NextResponse.json({ error: message }, { status });
    }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
    try {
        const { id } = await params;

        const parsed = itemIdSchema.safeParse({ id });
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid ID format' },
                { status: 400 },
            );
        }

        await deleteItem(parsed.data.id);
        return NextResponse.json(
            { message: 'Item deleted successfully' },
            { status: 200 },
        );
    } catch (error) {
        const message =
            error instanceof Error ? error.message : 'Unexpected error';
        const status = message.includes('not found') ? 404 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}
