import { z } from 'zod';

// ─── Customer master ────────────────────────────────────────────────────────
// A customer is identified by name + phone (unique per company), so a returning
// walk-in can be found at the counter by typing either.

export const createCustomerSchema = z.object({
    name: z.string().min(1, 'Customer name is required').max(200).trim(),
    phone: z.string().max(50).trim().optional().nullable(),
    email: z.string().email('Invalid email').max(200).optional().nullable(),
    address: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    is_active: z.boolean().default(true),
});

export const updateCustomerSchema = createCustomerSchema.partial();

export const customerIdSchema = z.object({
    id: z.coerce.number().int().positive(),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;

export type Customer = {
    id: number;
    company_id: number;
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    notes: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
};
