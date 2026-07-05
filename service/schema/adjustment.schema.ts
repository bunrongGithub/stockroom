import { z } from 'zod';

// ─── Stock Adjustment ───────────────────────────────────────────────────────

const adjustmentLineSchema = z.object({
    id: z.number().int().positive().optional(), // existing line (edit diff-sync)
    item_id: z.number().int().positive(),
    item_uom_id: z.number().int().positive().optional().nullable(),
    description: z.string().optional().nullable(),
    current_qty: z.number(),
    adjustment_qty: z
        .number()
        .refine((n) => n !== 0, 'Adjustment quantity cannot be 0'),
    unit_cost: z.number().min(0).optional().nullable(),
    serial_numbers: z.array(z.string().trim().min(1)).default([]),
    remarks: z.string().optional().nullable(),
});

const adjustmentHeaderBase = {
    // User-entered reference — never generated.
    reference_no: z.string().max(100).trim().optional().nullable(),
    adjustment_date: z.string(),
    warehouse_id: z.number().int().positive(),
    location_id: z.number().int().positive(),
    reason_code: z.string().min(1, 'Adjustment reason is required'),
    remarks: z.string().optional().nullable(),
};

export const createStockAdjustmentSchema = z.object({
    ...adjustmentHeaderBase,
    items: z.array(adjustmentLineSchema).min(1, 'Add at least one item'),
});

export const updateStockAdjustmentSchema = createStockAdjustmentSchema;

export const stockAdjustmentIdSchema = z.object({
    id: z.coerce.number().int().positive(),
});

export type CreateStockAdjustmentInput = z.infer<
    typeof createStockAdjustmentSchema
>;
export type UpdateStockAdjustmentInput = z.infer<
    typeof updateStockAdjustmentSchema
>;
