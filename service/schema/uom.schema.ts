import { z } from 'zod';

export const createUomSchema = z.object({
    name: z
        .string()
        .min(1, 'Name is required')
        .max(100, 'Name must be 100 characters or less')
        .trim(),
    reference_no: z.string().optional(),
});

export const updateUomSchema = z.object({
    name: z
        .string()
        .min(1, 'Name is required')
        .max(100, 'Name must be 100 characters or less')
        .trim()
        .optional(),
    reference_no: z.string().optional(),
});

export const itemIdSchema = z.object({
    id: z.coerce.number().int().positive(),
});

export type CreateUomInput = z.infer<typeof createUomSchema>;
export type UpdateUomInput = z.infer<typeof updateUomSchema>;

export const createItemUomSchema = z.object({
    // The unit's name lives on inventory_uom — never duplicated here.
    item_id: z.number().int().positive(),
    uom_id: z.number().int().positive(),
    is_default: z.boolean().default(true),
    // Rule 5: strictly greater than zero. Mirrored by a CHECK constraint.
    conversion: z.number().positive('Conversion must be greater than zero').default(1),
    conversion_type: z.enum(['MULTIPLY', 'DIVIDE']).default('MULTIPLY'),
    is_active: z.boolean().default(true),
});

/** What the UOM Details tab submits for one row (item comes from the route). */
export const itemUomDetailSchema = z.object({
    id: z.number().int().positive().optional(),
    uom_id: z.number().int().positive(),
    conversion: z.number().positive('Conversion must be greater than zero'),
    conversion_type: z.enum(['MULTIPLY', 'DIVIDE']).default('MULTIPLY'),
    is_active: z.boolean().default(true),
});

/** The whole UOM Details list, replacing an item's non-base UOMs. */
export const saveItemUomsSchema = z.object({
    uoms: z.array(itemUomDetailSchema).default([]),
});

export const updateItemUomSchema = itemUomDetailSchema.partial().omit({ id: true });

export type CreateItemUomInput = z.infer<typeof createItemUomSchema>;
export type ItemUomDetailInput = z.infer<typeof itemUomDetailSchema>;
export type SaveItemUomsInput = z.infer<typeof saveItemUomsSchema>;
