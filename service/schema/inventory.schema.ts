import { z } from 'zod';

export const itemClassEnum = z.enum(['stock', 'non_stock', 'service']);

const msgRequiredField = 'This field may not be null';
const inventoryBaseSchema = {
    name: z
        .string()
        .min(1, 'Item name is required')
        .max(255, 'Item name must be less than 255 characters')
        .trim(),

    reference_no: z.string().max(100).trim().optional().nullable(),

    sku: z.string().max(100).trim().optional().nullable(),

    description: z.string().optional().nullable(),

    item_class: itemClassEnum.default('stock'),

    price: z.coerce.number({ error: msgRequiredField }),

    min_price: z.coerce.number({ error: msgRequiredField }),

    max_price: z.coerce.number({ error: msgRequiredField }),

    // Cost is optional (never used in inventory valuation). Non-stock items in
    // particular may have no cost; stock items may still provide one.
    cost: z.coerce.number().min(0).optional().nullable(),

    is_variant: z.boolean().default(false),
    is_discount: z.boolean().default(false),
    is_sellable: z.boolean().default(false),
    is_returnable: z.boolean().default(false),
    is_warranty: z.boolean().default(false),
    track_serial: z.boolean().default(false),

    warranty_duration: z.string().max(100).optional().nullable(),

    category_id: z.number({ error: msgRequiredField }).int(),

    uom_id: z.number({ error: msgRequiredField }).int(),

    default_warehouse_id: z.number().int().optional().nullable(),

    default_location_id: z.number().int().optional().nullable(),
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
    is_sellable: inventoryBaseSchema.is_sellable.optional(),
    is_returnable: inventoryBaseSchema.is_returnable.optional(),
    is_warranty: inventoryBaseSchema.is_warranty.optional(),
    track_serial: inventoryBaseSchema.track_serial.optional(),
    warranty_duration: inventoryBaseSchema.warranty_duration,
    category_id: inventoryBaseSchema.category_id.optional(),
    uom_id: inventoryBaseSchema.uom_id,
    default_warehouse_id: inventoryBaseSchema.default_warehouse_id,
    default_location_id: inventoryBaseSchema.default_location_id,
});

export const itemIdSchema = z.object({
    id: z.coerce.number().int().positive(),
});

export type CreateInventoryInput = z.infer<typeof createInventorySchema>;
export type UpdateInventoryInput = z.infer<typeof updateInventorySchema>;
export type ItemIdInput = z.infer<typeof itemIdSchema>;
