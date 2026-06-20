import { z } from 'zod';

export const createInventoryUomSchema = z.object({
    name: z
        .string()
        .min(1, 'Name is required')
        .max(100, 'Name must be 100 characters or less')
        .trim(),
    display_name: z
        .string()
        .min(1, 'Display name is required')
        .max(20, 'Display name must be 20 characters or less')
        .trim(),
});

export const updateInventoryUomSchema = z.object({
    name: z
        .string()
        .min(1, 'Name is required')
        .max(100, 'Name must be 100 characters or less')
        .trim()
        .optional(),
    display_name: z
        .string()
        .min(1, 'Display name is required')
        .max(20, 'Display name must be 20 characters or less')
        .trim()
        .optional(),
});

export const inventoryUomIdSchema = z.object({
    id: z.coerce.number().int().positive(),
});

export type CreateInventoryUomInput = z.infer<typeof createInventoryUomSchema>;
export type UpdateInventoryUomInput = z.infer<typeof updateInventoryUomSchema>;
