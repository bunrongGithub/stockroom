import { PERMISSIONS, requirePermission } from '@/service/core/authz';
import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { SalesInvoiceRepository } from '@/service/apps/sale/repo/invoice';
import { createSalesInvoiceSchema } from '@/service/schema/sale-invoice.schema';
import { ApiError, ApiResponseSuccess } from '@/service/core/api-response';
import { parseListParams } from '@/service/core/query/http.ts';
import { z } from 'zod';

export const service = SalesInvoiceRepository.getInstance();

export async function GET(req: NextRequest) {
    try {
        const ctx = getRequestContext(req);
        await requirePermission(ctx, PERMISSIONS.sales.invoice.view, { req: req });
        const sp = req.nextUrl.searchParams;

        // Legacy: invoices for a specific shipment (shipment detail
        // "Invoices" tab) keep their unpaginated response shape.
        const shipmentId = Number(sp.get('shipment_id'));
        if (shipmentId) {
            const data = await service.findByShipment(ctx, shipmentId);
            return new ApiResponseSuccess({ data }, 'Success').toResponse();
        }

        const result = await service.findAllV2(ctx, parseListParams(req));
        return new ApiResponseSuccess(result, 'Success').toResponse();
    } catch (error) {
        if (error instanceof ApiError) return error.toResponse();
        const message =
            error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const ctx = getRequestContext(req);
        await requirePermission(ctx, PERMISSIONS.sales.invoice.create, { req: req });
        const body = await req.json();
        const parsed = createSalesInvoiceSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: z.flattenError(parsed.error).fieldErrors },
                { status: 422 },
            );
        }
        // Shipment-sourced when a shipment is given (direct order lines are
        // auto-included); order-sourced for shipmentless (non-stock/service
        // only) invoicing.
        const data = parsed.data.shipment_id
            ? await service.createFromShipment(ctx, parsed.data)
            : await service.createFromOrder(ctx, parsed.data);
        return new ApiResponseSuccess({ data }, 'Created', 201).toResponse();
    } catch (error) {
        if (error instanceof ApiError) return error.toResponse();
        const message =
            error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
