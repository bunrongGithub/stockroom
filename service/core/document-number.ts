import { getServerClient } from '@/lib/supabase/server';
import { ApiError } from './api-response';
import type { RequestContext } from '@/types/request-context';

// ─── Document Number framework ──────────────────────────────────────────────
// Every business document takes its number from here — never generate numbers
// in a repo. Backed by the atomic `next_document_number` Postgres function
// (per company × doc_type counter with prefix/padding/reset config in the
// document_sequence table), which is concurrency-safe by construction.
//
// Adding a future module = one call with its doc type + default prefix; the
// sequence row auto-seeds on first use. Prefix/padding/reset are DATA — a
// future Company Settings page edits document_sequence rows.

export type DocumentType =
    | 'sales_order'
    | 'sales_shipment'
    | 'sales_invoice'
    | 'inventory_receipt'
    | 'inventory_movement'
    | 'customer_payment'
    // master data (reference numbers):
    | 'stock_item'
    | 'non_stock_item'
    | 'service_item'
    | 'item_category'
    | 'item_uom'
    | 'business_partner'
    // future modules:
    | 'purchase_order'
    | 'purchase_invoice'
    | 'payment'
    | 'sales_return'
    | 'purchase_return'
    | 'inventory_transfer'
    | 'stock_adjustment'
    | 'stock_count';

export async function getNextDocumentNumber(
    ctx: RequestContext,
    docType: DocumentType,
    defaultPrefix: string,
): Promise<string> {
    const { data, error } = await getServerClient().rpc(
        'next_document_number',
        {
            p_company_id: Number(ctx.companyId),
            p_doc_type: docType,
            p_default_prefix: defaultPrefix,
        },
    );

    if (error) throw new ApiError(error.message, 500, 'DOC_NUMBER_ERROR');
    if (!data) throw new ApiError('Failed to generate document number', 500);
    return data as string;
}
