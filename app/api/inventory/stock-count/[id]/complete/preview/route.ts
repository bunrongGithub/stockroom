import { PERMISSIONS, requirePermission } from '@/service/core/authz';
import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { StockCountRepository } from '@/service/apps/inventory/repo/stock-count';
import { stockCountIdSchema } from '@/service/schema/stock-count.schema';
import { ApiError, ApiResponseSuccess } from '@/service/core/api-response';
import type { RequestParam } from '@/app/api/http';
import { z } from 'zod';

const service = StockCountRepository.getInstance();

/**
 * Dry run of completion. The policy comes in as a query param because the user
 * is still choosing it in the dialog this preview feeds — it is only persisted
 * when they commit.
 */
const previewQuerySchema = z.object({
    uncounted_policy: z.enum(['ignore', 'zero']).optional(),
});

export async function GET(req: NextRequest, { params }: RequestParam) {
    try {
        const ctx = getRequestContext(req);
        await requirePermission(ctx, PERMISSIONS.inventory.stockCount.view, { req: req });
        const { id } = await params;
        const idParsed = stockCountIdSchema.safeParse({ id });
        if (!idParsed.success) {
            return NextResponse.json(
                { error: 'Invalid stock count ID' },
                { status: 400 },
            );
        }
        const queryParsed = previewQuerySchema.safeParse({
            uncounted_policy:
                req.nextUrl.searchParams.get('uncounted_policy') ?? undefined,
        });
        if (!queryParsed.success) {
            return NextResponse.json(
                { error: z.flattenError(queryParsed.error).fieldErrors },
                { status: 422 },
            );
        }
        const data = await service.completionPreview(
            ctx,
            idParsed.data.id,
            queryParsed.data.uncounted_policy,
        );
        return new ApiResponseSuccess({ data }, 'Success').toResponse();
    } catch (error) {
        if (error instanceof ApiError) return error.toResponse();
        const message =
            error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
