import {
    findAllItems,
    findItemById,
    insertItem,
    updateItemById,
    deleteItemById,
    type Category,
} from '@/lib/repositories/inventory-item-category';
import type {
    CreateCategoryInput,
    UpdateCategoryInput,
} from '@/lib/validations/inventory-item-category.schema';

export async function getAllItems(): Promise<Category[]> {
    return findAllItems();
}

export async function getItemById(id: number): Promise<Category> {
    const item = await findItemById(id);
    if (!item) throw new Error(`Item with id "${id}" not found`);
    return item;
}

export async function createItem(
    input: CreateCategoryInput,
): Promise<Category> {
    // Business rule: no duplicate names
    const all = await findAllItems();
    const exists = all.some(
        (i) => i.name.toLowerCase() === input.name.toLowerCase(),
    );
    if (exists) throw new Error(`An item named "${input.name}" already exists`);

    return insertItem(input);
}

export async function updateItem(
    id: number,
    input: UpdateCategoryInput,
): Promise<Category> {
    // Ensure item exists before updating
    await getItemById(id);

    // Business rule: no duplicate names when renaming
    if (input.name) {
        const all = await findAllItems();
        const duplicate = all.some(
            (i) =>
                i.name.toLowerCase() === input.name!.toLowerCase() &&
                i.id !== Number(id),
        );
        if (duplicate)
            throw new Error(`An item named "${input.name}" already exists`);
    }

    return updateItemById(id, input);
}

export async function deleteItem(id: number): Promise<void> {
    await getItemById(id); // Ensure it exists first
    return deleteItemById(id);
}
