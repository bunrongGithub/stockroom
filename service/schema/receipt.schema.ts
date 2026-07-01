import { z } from 'zod';

// ─── Status ──────────────────────────────────────────────────────────────────

export const receiptStatusEnum = z.enum(['DRAFT', 'POSTED', 'VOID']);
export type ReceiptStatus = z.infer<typeof receiptStatusEnum>;

// ─── Receipt Line ─────────────────────────────────────────────────────────────

const receiptItemBaseSchema = {
    item_id: z.number().int().positive(),
    warehouse_id: z.number().int().positive(),
    location_id: z.number().int().positive(),
    item_uom_id: z.number().int().positive().optional().nullable(),

    receipt_qty: z.number().positive('Receipt quantity must be greater than 0'),
    lot_number: z.string().optional().nullable(),
    purchased_date: z.string().optional().nullable(),
    unit_cost: z.number().min(0).optional().nullable(),
};

export const createReceiptLineSchema = z.object(receiptItemBaseSchema);
export const updateReceiptLineSchema = z.object(receiptItemBaseSchema);

export type CreateReceiptLineInput = z.infer<typeof createReceiptLineSchema>;

// ─── Receipt Header ───────────────────────────────────────────────────────────

const receiptTxnBaseSchema = {
    transaction_date: z.string(),
    reference_no: z.string().optional().nullable(),
    status: z.string(),
    reason: z.string(),
    movement_type: z.string(),
    notes: z.string().optional().nullable(),
};

export const createReceiptSchema = z.object({
    ...receiptTxnBaseSchema,
    items: z
        .array(createReceiptLineSchema)
        .min(1, 'At least one receipt line is required'),
});

export const updateReceiptSchema = z.object({
    ...receiptTxnBaseSchema,
    // Passing lines replaces all existing lines (full replace strategy)
    items: z.array(updateReceiptLineSchema).min(1).optional(),
});

export const receiptIdSchema = z.object({
    id: z.coerce.number().int().positive(),
});

export type CreateReceiptInput = z.infer<typeof createReceiptSchema>;
export type UpdateReceiptInput = z.infer<typeof updateReceiptSchema>;
