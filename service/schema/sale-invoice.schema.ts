import { z } from 'zod';

// ─── Sales Invoice Line ─────────────────────────────────────────────────────

const invoiceLineBase = {
    id: z.number().int().positive().optional(), // existing line (edit diff-sync)
    item_id: z.number().int().positive(),
    sales_order_item_id: z.number().int().positive().optional().nullable(),
    shipment_item_id: z.number().int().positive().optional().nullable(),
    description: z.string().optional().nullable(),
    uom: z.string().optional().nullable(),
    quantity: z.number().positive('Quantity must be greater than 0'),
    unit_price: z.number().min(0, 'Unit price cannot be negative'),
    discount: z.number().min(0).max(100).default(0), // percent
    tax: z.number().min(0).max(100).default(0), // percent
};

export const createSalesInvoiceLineSchema = z.object(invoiceLineBase);
export const updateSalesInvoiceLineSchema = z.object(invoiceLineBase);

// ─── Sales Invoice Header ───────────────────────────────────────────────────

const invoiceHeaderBase = {
    invoice_date: z.string(),
    currency: z.string().default('USD'),
    exchange_rate: z.number().positive().optional(),
    customer_name: z.string().optional().nullable(),
    customer_phone: z.string().optional().nullable(),
    customer_address: z.string().optional().nullable(),
    remarks: z.string().optional().nullable(),
};

export const createSalesInvoiceSchema = z.object({
    shipment_id: z.number().int().positive(),
    ...invoiceHeaderBase,
    // Optional on create: the server copies the lines from the shipment/order
    // when omitted; when the user reviewed/edited them the client sends them.
    items: z.array(createSalesInvoiceLineSchema).min(1).optional(),
});

export const updateSalesInvoiceSchema = z.object({
    ...invoiceHeaderBase,
    items: z.array(updateSalesInvoiceLineSchema).min(1).optional(),
});

export const salesInvoiceIdSchema = z.object({
    id: z.coerce.number().int().positive(),
});

export type CreateSalesInvoiceInput = z.infer<typeof createSalesInvoiceSchema>;
export type UpdateSalesInvoiceInput = z.infer<typeof updateSalesInvoiceSchema>;
