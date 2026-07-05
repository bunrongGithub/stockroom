import { z } from 'zod';

export const updateCompanySchema = z.object({
    name: z.string().min(2).max(120).trim().optional(),
    registration_number: z.string().max(100).trim().nullable().optional(),
    tax_number: z.string().max(100).trim().nullable().optional(),
    phone: z.string().max(50).trim().nullable().optional(),
    email: z
        .string()
        .email('Invalid email address')
        .or(z.literal(''))
        .nullable()
        .optional(),
    website: z.string().max(255).trim().nullable().optional(),
    address: z.string().max(1000).trim().nullable().optional(),
    description: z.string().max(2000).trim().nullable().optional(),
    status: z.enum(['active', 'inactive', 'suspended']).optional(),
});

export const assignRoleSchema = z.object({
    userId: z.string().uuid(),
    roleId: z.coerce.number().int().positive(),
});

export const removeUserSchema = z.object({
    userId: z.string().uuid(),
});

export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;
export type AssignRoleInput = z.infer<typeof assignRoleSchema>;
export type RemoveUserInput = z.infer<typeof removeUserSchema>;
