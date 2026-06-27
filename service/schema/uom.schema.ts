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
    name: z.string().min(1).max(100).trim(),
    display_name: z.string().max(20).optional().nullable(),
    item_id: z.number().int().positive(),
    uom_id: z.number().int().positive(),
    is_default: z.boolean().default(true),
    conversion: z.number().default(1),
    factor: z.number().default(1),
});

export type CreateItemUomInput = z.infer<typeof createItemUomSchema>;
