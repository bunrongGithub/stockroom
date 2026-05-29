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
