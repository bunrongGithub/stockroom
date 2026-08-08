import { z } from 'zod';

export const createRoleSchema = z.object({
    name: z
        .string()
        .min(1, 'This field may not be null')
        .max(100, 'Name must be 100 characters or less')
        .trim(),
    // Optional, matching updateRoleSchema — a role is identified by its name,
    // and requiring prose here blocked creating one from the editor.
    description: z
        .string()
        .max(500, 'Description must be 500 characters or less')
        .trim()
        .nullable()
        .optional(),
    is_active: z.boolean().optional().default(true),
    company_id: z.coerce.number().nullable(),
});

export const updateRoleSchema = z.object({
    name: z
        .string()
        .min(1, 'Name is required')
        .max(100, 'Name must be 100 characters or less')
        .trim(),
    description: z.string().max(500).trim().nullable().optional(),
    is_active: z.boolean().optional(),
});

/**
 * Per-action grant for one module — the shape the permission editor speaks and
 * `role_module_action_permission` stores. `actions` are verbs from the
 * PERMISSIONS catalog ('view', 'post', 'void', …); an empty list revokes the
 * module entirely.
 */
export const moduleActionGrantSchema = z.object({
    module_id: z.number().int().positive(),
    actions: z.array(z.string().min(1).max(30)),
});

/** Role header + its complete grant set, saved together. */
export const saveRoleSchema = z.object({
    name: z
        .string()
        .min(1, 'Name is required')
        .max(100, 'Name must be 100 characters or less')
        .trim(),
    description: z.string().max(500).trim().nullable().optional(),
    is_active: z.boolean().optional().default(true),
    permissions: z.array(moduleActionGrantSchema).optional().default([]),
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
            can_export: z.boolean().optional().default(false),
        }),
    ),
});

export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
export type UpdateRolePermissionsInput = z.infer<typeof updateRolePermissionsSchema>;
export type ModuleActionGrantInput = z.infer<typeof moduleActionGrantSchema>;
export type SaveRoleInput = z.infer<typeof saveRoleSchema>;
