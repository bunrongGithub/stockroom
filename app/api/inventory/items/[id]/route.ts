import { PERMISSIONS, requirePermission } from '@/service/core/authz';
import { getRequestContext } from '@/lib/request-context';
import { itemIdSchema } from '@/service/schema/inventory.schema';
import { NextRequest, NextResponse } from 'next/server';
import { InventoryRepository } from '@/service/apps/inventory/repo/stock';

const Service = InventoryRepository.getInstance();

type Params = { params: Promise<{ id: string }> };

/**
 * Class-agnostic item detail — used by auto-fill (itemApi.getDefaults) so a
 * picked non-stock or service item resolves the same way a stock item does.
 * The per-class config endpoints keep their class guards; this one does not.
 */
export async function GET(req: NextRequest, { params }: Params) {
    try {
        const ctx = getRequestContext(req);
        await requirePermission(ctx, PERMISSIONS.inventory.item.view, { req: req });
        const { id } = await params;

        const parsed = itemIdSchema.safeParse({ id });
        if (!parsed.success) {
            return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
        }

        const item = await Service.findOne(ctx, parsed.data.id);
        if (!item) {
            return NextResponse.json({ error: 'Item not found' }, { status: 404 });
        }

        return NextResponse.json({ data: item }, { status: 200 });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
