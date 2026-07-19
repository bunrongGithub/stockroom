import { PERMISSIONS, requirePermission } from '@/service/core/authz';
import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import {
    SalesAnalyticsService,
    PaymentAnalyticsService,
} from '@/service/apps/dashboard/analytics';
import { AnalyticsRangeError } from '@/service/apps/dashboard/analytics/range';
import { ApiError, ApiResponseSuccess } from '@/service/core/api-response';
import { z } from 'zod';

const paramsSchema = z.object({
    metric: z.enum(['sales', 'payments']),
});

const querySchema = z.object({
    range: z
        .enum([
            'today',
            'last_7_days',
            'last_30_days',
            'this_month',
            'last_month',
            'this_year',
            'custom',
        ])
        .default('last_30_days'),
    from: z.string().optional(),
    to: z.string().optional(),
});

// GET /api/dashboard/analytics/[metric]?range=last_30_days
// One aggregated point per bucket — never raw transactions.
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ metric: string }> },
) {
    try {
        const ctx = getRequestContext(req);
        await requirePermission(ctx, PERMISSIONS.dashboard.view, { req: req });
        const parsedParams = paramsSchema.safeParse(await params);
        if (!parsedParams.success) {
            return NextResponse.json({ error: 'Unknown metric' }, { status: 404 });
        }
        const parsedQuery = querySchema.safeParse(
            Object.fromEntries(req.nextUrl.searchParams),
        );
        if (!parsedQuery.success) {
            return NextResponse.json({ error: 'Invalid query' }, { status: 400 });
        }

        const { metric } = parsedParams.data;
        const { range, from, to } = parsedQuery.data;
        const service =
            metric === 'sales' ? SalesAnalyticsService : PaymentAnalyticsService;
        const data = await service.getTrend(ctx, range, from, to);
        return new ApiResponseSuccess({ data }, 'Success').toResponse();
    } catch (error) {
        if (error instanceof AnalyticsRangeError) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        if (error instanceof ApiError) return error.toResponse();
        const message =
            error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
