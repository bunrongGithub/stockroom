import { z } from 'zod';

export const createCategorySchema = z.object({
    name: z
        .string()
        .min(1, 'Name is required')
        .max(100, 'Name must be 100 characters or less')
        .trim(),
    reference_no: z
        .string()
        .min(1, 'Reference number is required')
        .max(500, 'Reference number must be 500 characters or less')
        .trim(),
});

export const updateCategorySchema = z.object({
    name: z
        .string()
        .min(1, 'Name is required')
        .max(100, 'Name must be 100 characters or less')
        .trim()
        .optional(),
    reference_no: z
        .string()
        .min(1, 'Reference number is required')
        .max(500, 'Reference number must be 500 characters or less')
        .trim()
        .optional(),
});

export const itemIdSchema = z.object({
    id: z.coerce.number().int().positive(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
