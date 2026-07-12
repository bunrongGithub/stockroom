import { z } from 'zod';

const roleIds = z
    .array(z.coerce.number().int().positive())
    .min(1, 'Assign at least one role');

export const createUserSchema = z.object({
    email: z.string().email('Invalid email address').trim().toLowerCase(),
    full_name: z.string().min(2, 'Full name is required').max(120).trim(),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    phone: z.string().max(50).trim().optional().or(z.literal('')),
    status: z.enum(['active', 'inactive']).optional().default('active'),
    role_ids: roleIds,
});

export const updateUserSchema = z.object({
    full_name: z.string().min(2).max(120).trim().optional(),
    phone: z.string().max(50).trim().optional().or(z.literal('')),
    avatar_url: z.string().url().optional().or(z.literal('')),
    status: z.enum(['active', 'inactive']).optional(),
    role_ids: roleIds.optional(),
});

export const setRolesSchema = z.object({ role_ids: roleIds });

export const setStatusSchema = z.object({
    status: z.enum(['active', 'inactive']),
});

// Accept the 8-4-4-4-12 hex UUID shape without enforcing the RFC-4122 variant
// bits — dev/seed accounts use synthetic ids (e.g. 22222222-…) that strict
// z.uuid() rejects.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const userIdSchema = z.object({
    id: z.string().regex(UUID_RE, 'Invalid user id'),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
