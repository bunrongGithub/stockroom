import { PERMISSIONS, requirePermission } from '@/service/core/authz';
import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { SalesInvoiceRepository } from '@/service/apps/sale/repo/invoice';
import { ApiError, ApiResponseSuccess } from '@/service/core/api-response';

const service = SalesInvoiceRepository.getInstance();

// GET /api/finances/invoice/outstanding?customer=&search=&page=&limit=
// POSTED invoices with a remaining balance (for the payment allocation grid).
// Server-side filtered + paginated so a customer with thousands of invoices
// never loads everything.
export async function GET(req: NextRequest) {
    try {
        const ctx = getRequestContext(req);
        await requirePermission(ctx, PERMISSIONS.sales.invoice.view, { req: req });
        const sp = req.nextUrl.searchParams;
        const result = await service.findOutstanding(ctx, {
            page: Number(sp.get('page') || 1),
            limit: Number(sp.get('limit') || 10),
            search: sp.get('search') ?? undefined,
            customer: sp.get('customer') ?? undefined,
            phone: sp.get('phone') ?? undefined,
        });
        return new ApiResponseSuccess(result, 'Success').toResponse();
    } catch (error) {
        if (error instanceof ApiError) return error.toResponse();
        const message =
            error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
