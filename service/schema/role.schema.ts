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
        .trim(),
    description: z.string().max(500).trim().nullable().optional(),
});

export const itemIdSchema = z.object({
    id: z.coerce.number().int().positive(),
});

export const updateRolePermissionsSchema = z.object({
    permissions: z.array(
        z.object({
            module_id: z.number().int().positive(),
            can_view: z.boolean(),
            can_create: z.boolean(),
            can_update: z.boolean(),
            can_delete: z.boolean(),
        }),
    ),
});

export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
export type UpdateRolePermissionsInput = z.infer<typeof updateRolePermissionsSchema>;
