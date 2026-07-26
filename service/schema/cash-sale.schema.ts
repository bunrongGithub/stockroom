import { z } from 'zod';

// ─── Cash Sale ──────────────────────────────────────────────────────────────
// A Cash Sale is a WORKFLOW, not a document: this payload is turned into a real
// Sales Order → Shipment → Invoice → Payment chain. There is no cash_sale table
// and no cash_sale document schema.

/** Cash Sale accepts every settled method; KHQR is wired to the gateway seam. */
export const cashSalePaymentMethodEnum = z.enum([
    'CASH',
    'CARD',
    'BANK_TRANSFER',
    'CHEQUE',
    'KHQR',
]);

const cashSaleLineSchema = z.object({
    item_id: z.number().int().positive(),
    item_uom_id: z.number().int().positive().optional().nullable(),
    description: z.string().optional().nullable(),
    quantity: z.number().positive('Quantity must be greater than 0'),
    // Optional: the server falls back to the item's list price and always
    // re-validates whatever it is given against the item's min/max bounds.
    unit_price: z.number().min(0).optional(),
    discount: z.number().min(0).max(100).default(0), // percent
    tax: z.number().min(0).max(100).default(0), // percent
    // Per-line location override; defaults to the sale's location.
    location_id: z.number().int().positive().optional().nullable(),
    serial_numbers: z.array(z.string().trim().min(1)).optional().default([]),
});

const cashSaleCustomerSchema = z.object({
    // Registered customer, or null for a walk-in.
    customer_id: z.number().int().positive().optional().nullable(),
    name: z.string().min(1).max(200).trim().default('Walk-in Customer'),
    phone: z.string().max(50).trim().optional().nullable(),
});

export const cashSaleSchema = z.object({
    // Makes "Complete Sale" safe to retry / double-click: replaying a key
    // returns the original sale instead of selling the stock twice.
    idempotency_key: z.string().min(8).max(100).optional(),
    customer: cashSaleCustomerSchema.default({ name: 'Walk-in Customer' }),
    // Warehouse/location come from Sales Settings unless explicitly overridden.
    warehouse_id: z.number().int().positive().optional(),
    location_id: z.number().int().positive().optional(),
    items: z.array(cashSaleLineSchema).min(1, 'Add at least one item'),
    payment_method: cashSalePaymentMethodEnum.default('CASH'),
    payment_reference_no: z.string().max(100).trim().optional().nullable(),
    currency: z.string().default('USD'),
    notes: z.string().optional().nullable(),
});

export type CashSaleInput = z.infer<typeof cashSaleSchema>;
export type CashSaleLineInput = z.infer<typeof cashSaleLineSchema>;
export type CashSalePaymentMethod = z.infer<typeof cashSalePaymentMethodEnum>;
