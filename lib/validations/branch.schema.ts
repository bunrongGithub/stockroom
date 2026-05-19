import { z } from 'zod';

export const idParamSchema = z.object({
    id: z.coerce.number().int().positive(),
});

export const branchCreateSchema = z.object({
    name: z.string({ error: 'Branch name is required' }).min(1).max(255),
    code: z.string().max(50).optional().nullable(),
    address: z.string().optional().nullable(),
    phone: z.string().max(50).optional().nullable(),
    is_default: z.boolean().optional().default(false),
});

export const branchUpdateSchema = branchCreateSchema.partial().extend({
    is_active: z.boolean().optional(),
});

export const stockLocationCreateSchema = z.object({
    branch_id: z.coerce.number().int().positive(),
    name: z.string({ error: 'Location name is required' }).min(1).max(255),
    code: z.string().max(50).optional().nullable(),
    description: z.string().optional().nullable(),
    is_default: z.boolean().optional().default(false),
});

export const stockLocationUpdateSchema = stockLocationCreateSchema
    .partial()
    .extend({ is_active: z.boolean().optional() });