import { z } from 'zod';

// ─── Sales Shipment Line ────────────────────────────────────────────────────

const shipmentLineBase = {
    sales_order_item_id: z.number().int().positive(),
    item_id: z.number().int().positive(),
    location_id: z.number().int().positive('Location is required'),
    item_uom_id: z.number().int().positive().optional().nullable(),
    ordered_qty: z.number().min(0).default(0),
    previously_shipped_qty: z.number().min(0).default(0),
    shipment_qty: z
        .number()
        .positive('Shipment quantity must be greater than 0'),
    serial_numbers: z.array(z.string().trim().min(1)).optional().default([]),
};

export const createSalesShipmentLineSchema = z.object(shipmentLineBase);
export const updateSalesShipmentLineSchema = z.object(shipmentLineBase);

export type CreateSalesShipmentLineInput = z.infer<
    typeof createSalesShipmentLineSchema
>;

// ─── Sales Shipment Header ──────────────────────────────────────────────────

const shipmentHeaderBase = {
    // User-entered reference (courier tracking, customer PO…) — never generated.
    reference_no: z.string().max(100).trim().optional().nullable(),
    sales_order_id: z.number().int().positive(),
    // Link to the Business Partner acting as customer (snapshot kept too).
    customer_id: z.number().int().positive().optional().nullable(),
    customer_name: z.string().optional().nullable(),
    customer_phone: z.string().min(1, 'Customer phone is required'),
    delivery_date: z.string(),
    warehouse_id: z.number().int().positive(),
    receiver_name: z.string().optional().nullable(),
    delivery_address: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
};

export const createSalesShipmentSchema = z.object({
    ...shipmentHeaderBase,
    items: z
        .array(createSalesShipmentLineSchema)
        .min(1, 'At least one item is required'),
});

export const updateSalesShipmentSchema = z.object({
    ...shipmentHeaderBase,
    items: z.array(updateSalesShipmentLineSchema).min(1).optional(),
});

export const salesShipmentIdSchema = z.object({
    id: z.coerce.number().int().positive(),
});

export type CreateSalesShipmentInput = z.infer<
    typeof createSalesShipmentSchema
>;
export type UpdateSalesShipmentInput = z.infer<
    typeof updateSalesShipmentSchema
>;
