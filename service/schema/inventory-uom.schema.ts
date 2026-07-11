import { z } from 'zod';

const codeField = z
    .string()
    .min(1, 'Code is required')
    .max(20, 'Code must be 20 characters or less')
    .trim()
    .transform((v) => v.toUpperCase());

const nameField = z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be 100 characters or less')
    .trim();

const displayNameField = z
    .string()
    .min(1, 'Display name is required')
    .max(20, 'Display name must be 20 characters or less')
    .trim();

const descriptionField = z
    .string()
    .max(500, 'Description must be 500 characters or less')
    .trim()
    .optional();

export const createInventoryUomSchema = z.object({
    code: codeField,
    name: nameField,
    display_name: displayNameField,
    description: descriptionField,
    is_active: z.boolean().optional().default(true),
    is_default: z.boolean().optional().default(false),
});

export const updateInventoryUomSchema = z.object({
    code: codeField.optional(),
    name: nameField.optional(),
    display_name: displayNameField.optional(),
    description: descriptionField,
    is_active: z.boolean().optional(),
    is_default: z.boolean().optional(),
});

export const inventoryUomIdSchema = z.object({
    id: z.coerce.number().int().positive(),
});

export type CreateInventoryUomInput = z.infer<typeof createInventoryUomSchema>;
export type UpdateInventoryUomInput = z.infer<typeof updateInventoryUomSchema>;
