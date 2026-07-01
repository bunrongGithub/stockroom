import { z } from 'zod';

// ─── Sales Order Line ───────────────────────────────────────────────────────

const orderLineBase = {
    item_id: z.number().int().positive(),
    item_uom_id: z.number().int().positive().optional().nullable(),
    description: z.string().optional().nullable(),
    uom: z.string().optional().nullable(),
    ordered_qty: z.number().positive('Quantity must be greater than 0'),
    unit_price: z.number().min(0, 'Unit price cannot be negative'),
    discount: z.number().min(0).max(100).default(0), // percent
    tax: z.number().min(0).max(100).default(0), // percent
};

export const createSalesOrderLineSchema = z.object(orderLineBase);
export const updateSalesOrderLineSchema = z.object({
    ...orderLineBase,
    // existing line id — present rows keep their accrued shipped_qty
    id: z.number().int().positive().optional(),
});

export type CreateSalesOrderLineInput = z.infer<
    typeof createSalesOrderLineSchema
>;
export type UpdateSalesOrderLineInput = z.infer<
    typeof updateSalesOrderLineSchema
>;

// ─── Sales Order Header ─────────────────────────────────────────────────────

const orderHeaderBase = {
    customer_name: z.string().min(1, 'Customer is required').trim(),
    customer_phone: z.string().optional().nullable(),
    order_date: z.string(),
    expected_delivery_date: z.string().optional().nullable(),
    warehouse_id: z.number().int().positive('Warehouse is required'),
    currency: z.string().default('USD'),
    notes: z.string().optional().nullable(),
};

export const createSalesOrderSchema = z.object({
    ...orderHeaderBase,
    items: z
        .array(createSalesOrderLineSchema)
        .min(1, 'At least one item is required'),
});

export const updateSalesOrderSchema = z.object({
    ...orderHeaderBase,
    // Passing items replaces all lines (full-replace, shipped_qty preserved by id)
    items: z.array(updateSalesOrderLineSchema).min(1).optional(),
});

export const salesOrderIdSchema = z.object({
    id: z.coerce.number().int().positive(),
});

export type CreateSalesOrderInput = z.infer<typeof createSalesOrderSchema>;
export type UpdateSalesOrderInput = z.infer<typeof updateSalesOrderSchema>;
