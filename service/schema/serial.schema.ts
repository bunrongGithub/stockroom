import { z } from 'zod';

export const generateSerialsSchema = z.object({
    item_id: z.coerce.number().int().positive(),
    warehouse_id: z.coerce.number().int().positive().optional(),
    count: z.coerce.number().int().min(1).max(1000),
});

export const validateSerialsSchema = z.object({
    item_id: z.coerce.number().int().positive(),
    serials: z.array(z.string()).min(1).max(5000),
    mode: z.enum(['new', 'allocate']),
    warehouse_id: z.coerce.number().int().positive().optional(),
    location_id: z.coerce.number().int().positive().optional(),
});

export const serialSearchSchema = z.object({
    q: z.string().max(100).optional(),
    status: z
        .enum([
            'available',
            'reserved',
            'sold',
            'returned',
            'damaged',
            'scrapped',
            'removed',
            'transferred',
            'inactive',
        ])
        .optional(),
    item_id: z.coerce.number().int().positive().optional(),
    warehouse_id: z.coerce.number().int().positive().optional(),
    location_id: z.coerce.number().int().positive().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const updateSerialConfigSchema = z
    .object({
        strategy: z.enum([
            'sequential',
            'date_prefix',
            'item_prefix',
            'warehouse_prefix',
            'company_prefix',
            'random',
            'custom',
        ]),
        prefix: z.string().max(20),
        suffix: z.string().max(20),
        seq_length: z.coerce.number().int().min(1).max(20),
        start_number: z.coerce.number().int().min(1),
        reset_rule: z.enum(['never', 'yearly', 'monthly', 'daily']),
        pattern: z.string().max(100).nullable(),
    })
    .partial()
    .refine((v) => Object.keys(v).length > 0, {
        message: 'Nothing to update',
    });
