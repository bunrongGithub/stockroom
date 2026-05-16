import { z } from 'zod';

/**
 * Common enums
 */
export const itemClassEnum = z.enum(['stock', 'service', 'consumable']);

/**
 * Shared base schema
 */
const inventoryBaseSchema = {
    name: z
        .string()
        .min(1, 'Item name is required')
        .max(255, 'Item name must be less than 255 characters')
        .trim(),

    reference_no: z
        .string()
        .max(100, 'Reference number must be less than 100 characters')
        .trim()
        .optional()
        .nullable(),

    sku: z
        .string()
        .max(100, 'SKU must be less than 100 characters')
        .trim()
        .optional()
        .nullable(),

    price: z.coerce.number().min(0, 'Price cannot be negative'),

    sale_price: z.coerce.number().min(0, 'Sale price cannot be negative'),

    purchase_price: z.coerce
        .number()
        .min(0, 'Purchase price cannot be negative'),

    stock: z.coerce
        .number()
        .min(0, 'Stock cannot be negative')
        .optional()
        .nullable(),

    category_id: z.coerce
        .number({
            error: 'Category is required',
        })
        .int()
        .positive('Invalid category'),

    is_variant: z.boolean().default(false),

    is_discount: z.boolean().default(false),

    item_class: itemClassEnum.default('stock'),

    images_url: z
        .array(z.string().url('Invalid image URL'))
        .optional()
        .nullable(),
};

/**
 * Create schema
 */
export const createInventorySchema = z.object({
    ...inventoryBaseSchema,
});

/**
 * Update schema
 */
export const updateInventorySchema = z.object({
    name: inventoryBaseSchema.name.optional(),

    reference_no: inventoryBaseSchema.reference_no,

    sku: inventoryBaseSchema.sku,

    price: inventoryBaseSchema.price.optional(),

    sale_price: inventoryBaseSchema.sale_price.optional(),

    purchase_price: inventoryBaseSchema.purchase_price.optional(),

    stock: inventoryBaseSchema.stock,

    category_id: inventoryBaseSchema.category_id.optional(),

    is_variant: inventoryBaseSchema.is_variant.optional(),

    is_discount: inventoryBaseSchema.is_discount.optional(),

    item_class: inventoryBaseSchema.item_class.optional(),

    images_url: inventoryBaseSchema.images_url,
});

/**
 * Params schema
 */
export const itemIdSchema = z.object({
    id: z.coerce.number().int().positive(),
});

/**
 * Types
 */
export type CreateInventoryInput = z.infer<typeof createInventorySchema>;

export type UpdateInventoryInput = z.infer<typeof updateInventorySchema>;

export type ItemIdInput = z.infer<typeof itemIdSchema>;
