import { z } from 'zod';

export const ROLE_VALUES = ['supper_user', 'admin', 'staff', 'member'] as const;

export const createUserRoleSchema = z.object({
    name: z.enum(ROLE_VALUES, { message: 'Invalid role name' }),
    description: z.string().max(255).optional(),
});

export const updateUserRoleSchema = z.object({
    description: z.string().max(255).optional(),
});

export const itemIdSchema = z.object({
    id: z.coerce.number().int().positive(),
});

export type CreateUserRoleInput = z.infer<typeof createUserRoleSchema>;
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;
