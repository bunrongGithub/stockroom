import { z } from 'zod';

export const createRoleSchema = z.object({
    name: z
        .string()
        .min(1, 'This field may not be null')
        .max(100, 'Name must be 100 characters or less')
        .trim(),
    description: z
        .string()
        .min(1, 'This field may not be null')
        .max(500, 'description cannot be exect 500 character.')
        .trim(),
    company_id: z.coerce.number().nullable(),
});

export const updateRoleSchema = z.object({
    name: z
        .string()
        .min(1, 'Name is required')
        .max(100, 'Name must be 100 characters or less')
        .trim()
        .optional(),
});

export const itemIdSchema = z.object({
    id: z.coerce.number().int().positive(),
});

export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
