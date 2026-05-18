import { itemIdSchema } from '@/lib/validations/inventory.schema';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { service } from '../..';

// ─── Validation (Zod v4) ──────────────────────────────────────────────────────
const adjustStockSchema = z.object({
    received_quantity: z
        .number({ error: 'Received quantity must be a number' })
        .int('Quantity must be a whole number')
        .positive('Quantity must be greater than 0'),
    adjustment_reason: z
        .string({ error: 'Adjustment reason is required' })
        .min(1, 'Adjustment reason is required'),
});

// ─── Types ────────────────────────────────────────────────────────────────────
type Params = { params: Promise<{ id: string }> };

// ─── POST /api/inventory/[id]/adjust ─────────────────────────────────────────
export async function POST(req: NextRequest, { params }: Params) {
    try {
        const { id } = await params;

        // Validate item ID
        const idParsed = itemIdSchema.safeParse({ id });
        if (!idParsed.success) {
            return NextResponse.json(
                { error: 'Invalid ID format' },
                { status: 400 },
            );
        }

        // Validate request body
        const body = await req.json();
        const bodyParsed = adjustStockSchema.safeParse(body);
        if (!bodyParsed.success) {
            return NextResponse.json(
                { error: bodyParsed.error.flatten().fieldErrors },
                { status: 422 },
            );
        }

        const { received_quantity } = bodyParsed.data;

        // Fetch current item.
        // DB field is `stock numeric` on inventory_item table.
        // Cast to `any` because InventoryProduct type definition doesn't yet
        // declare the `stock` column — the DB field exists, the TS type lags.
        const currentItem = await service.getById(idParsed.data.id);
        const currentStock = Number((currentItem as any)?.stock ?? 0);
        const newStock = currentStock + received_quantity;

        // Persist — only update `stock` (numeric column in inventory_item)
        const updated = await service.update(idParsed.data.id, {
            stock: newStock,
        });

        return NextResponse.json({ data: updated }, { status: 200 });
    } catch (error) {
        const message =
            error instanceof Error ? error.message : 'Unexpected error';
        const status = message.includes('not found') ? 404 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}