import { z } from 'zod';

export const itemClassEnum = z.enum(['stock', 'non_stock', 'service', 'consumable']);

const inventoryBaseSchema = {
    name: z
        .string()
        .min(1, 'Item name is required')
        .max(255, 'Item name must be less than 255 characters')
        .trim(),

    reference_no: z
        .string()
        .max(100)
        .trim()
        .optional()
        .nullable(),

    sku: z
        .string()
        .max(100)
        .trim()
        .optional()
        .nullable(),

    description: z.string().optional().nullable(),

    item_class: itemClassEnum.default('stock'),

    /** Default selling price */
    price: z.coerce.number().min(0, 'Price cannot be negative'),

    /** Minimum selling price */
    min_price: z.coerce.number().min(0).optional().nullable(),

    /** Maximum selling price */
    max_price: z.coerce.number().min(0).optional().nullable(),

    /** Purchase / landed cost */
    cost: z.coerce.number().min(0, 'Cost cannot be negative').optional().nullable(),

    is_variant: z.boolean().default(false),
    is_discount: z.boolean().default(false),

    images_url: z.array(z.string()).optional().nullable(),

    warranty_duration: z.string().max(100).optional().nullable(),

    category_id: z.coerce
        .number({ error: 'Category is required' })
        .int()
        .positive('Invalid category'),

    uom_id: z
        .number({ error: 'UOM is required' })
        .int()
        .positive('Invalid UOM'),
};

export const createInventorySchema = z.object({
    ...inventoryBaseSchema,
});

export const updateInventorySchema = z.object({
    name: inventoryBaseSchema.name.optional(),
    reference_no: inventoryBaseSchema.reference_no,
    sku: inventoryBaseSchema.sku,
    description: inventoryBaseSchema.description,
    item_class: inventoryBaseSchema.item_class.optional(),
    price: inventoryBaseSchema.price.optional(),
    min_price: inventoryBaseSchema.min_price,
    max_price: inventoryBaseSchema.max_price,
    cost: inventoryBaseSchema.cost,
    is_variant: inventoryBaseSchema.is_variant.optional(),
    is_discount: inventoryBaseSchema.is_discount.optional(),
    images_url: inventoryBaseSchema.images_url,
    warranty_duration: inventoryBaseSchema.warranty_duration,
    category_id: inventoryBaseSchema.category_id.optional(),
    uom_id: inventoryBaseSchema.uom_id.optional(),
});

export const itemIdSchema = z.object({
    id: z.coerce.number().int().positive(),
});

export type CreateInventoryInput = z.infer<typeof createInventorySchema>;
export type UpdateInventoryInput = z.infer<typeof updateInventorySchema>;
export type ItemIdInput = z.infer<typeof itemIdSchema>;
