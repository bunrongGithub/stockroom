import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { SalesInvoiceRepository } from '@/service/apps/sale/repo/invoice';
import { salesInvoiceIdSchema } from '@/service/schema/sale-invoice.schema';
import { ApiError, ApiResponseSuccess } from '@/service/core/api-response';
import type { RequestParam } from '@/app/api/http';

const service = SalesInvoiceRepository.getInstance();

// Posted customer payments settling this invoice (invoice detail Payments tab).
export async function GET(req: NextRequest, { params }: RequestParam) {
    try {
        const ctx = getRequestContext(req);
        const { id } = await params;
        const idParsed = salesInvoiceIdSchema.safeParse({ id });
        if (!idParsed.success) {
            return NextResponse.json({ error: 'Invalid invoice ID' }, { status: 400 });
        }
        const data = await service.findPayments(ctx, idParsed.data.id);
        return new ApiResponseSuccess({ data }, 'Success').toResponse();
    } catch (error) {
        if (error instanceof ApiError) return error.toResponse();
        const message =
            error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
