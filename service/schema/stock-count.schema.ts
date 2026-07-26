import { z } from 'zod';

// ─── Physical Stock Count ───────────────────────────────────────────────────

const scopeFilterSchema = z
    .object({
        category_ids: z.array(z.number().int().positive()).optional(),
        item_ids: z.array(z.number().int().positive()).optional(),
    })
    .default({});

const stockCountHeaderBase = {
    count_date: z.string(),
    warehouse_id: z.number().int().positive(),
    location_id: z.number().int().positive().optional().nullable(),
    count_mode: z.enum(['full', 'location', 'category', 'items']).default('full'),
    scope_filter: scopeFilterSchema,
    remarks: z.string().optional().nullable(),
};

const requireScopeConsistency = (
    data: {
        count_mode: 'full' | 'location' | 'category' | 'items';
        location_id?: number | null;
        scope_filter: { category_ids?: number[]; item_ids?: number[] };
    },
    ctx: z.RefinementCtx,
) => {
    if (data.count_mode === 'location' && !data.location_id) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['location_id'],
            message: 'Location count requires a location',
        });
    }
    if (
        data.count_mode === 'category' &&
        !data.scope_filter.category_ids?.length
    ) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['scope_filter', 'category_ids'],
            message: 'Category count requires at least one category',
        });
    }
    if (data.count_mode === 'items' && !data.scope_filter.item_ids?.length) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['scope_filter', 'item_ids'],
            message: 'Item count requires at least one item',
        });
    }
};

export const createStockCountSchema = z
    .object(stockCountHeaderBase)
    .superRefine(requireScopeConsistency);

export const updateStockCountSchema = createStockCountSchema;

export const stockCountIdSchema = z.object({
    id: z.coerce.number().int().positive(),
});

export const stockCountLineIdSchema = z.object({
    id: z.coerce.number().int().positive(),
    lineId: z.coerce.number().int().positive(),
});

// Batched worksheet saves — counted_qty null reverts a line to uncounted.
export const recordCountsSchema = z.object({
    entries: z
        .array(
            z.object({
                line_id: z.number().int().positive(),
                counted_qty: z.number().min(0).nullable(),
                remarks: z.string().optional().nullable(),
            }),
        )
        .min(1)
        .max(200),
});

export const recordSerialsSchema = z.object({
    serials: z.array(z.string().trim().min(1)).min(1).max(500),
});

export const removeSerialSchema = z.object({
    serial_number: z.string().trim().min(1),
});

export const scanItemSchema = z.object({
    code: z.string().trim().min(1),
});

export const submitStockCountSchema = z.object({
    uncounted_policy: z.enum(['ignore', 'zero']).default('ignore'),
});

export const cancelStockCountSchema = z.object({
    reason: z.string().optional().nullable(),
});

export type CreateStockCountInput = z.infer<typeof createStockCountSchema>;
export type UpdateStockCountInput = z.infer<typeof updateStockCountSchema>;
export type RecordCountsInput = z.infer<typeof recordCountsSchema>;
export type RecordSerialsInput = z.infer<typeof recordSerialsSchema>;
export type SubmitStockCountInput = z.infer<typeof submitStockCountSchema>;
export type CancelStockCountInput = z.infer<typeof cancelStockCountSchema>;
