import { createClient } from '@/lib/supabase/server';
import type {
    CreateCategoryInput,
    UpdateCategoryInput,
} from '@/lib/validations/inventory-item-category.schema';

export type Category = {
    id: number;
    name: string;
    reference_no: string;
};

export async function findAllItems(): Promise<Category[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('inventory_item_category')
        .select('*');

    console.log(data, error)
    if (error) throw new Error(error.message);
    return data ?? [];
}

export async function findItemById(id: number): Promise<Category | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('inventory_item_category')
        .select('*')
        .eq('id', id)
        .single();

    if (error) {
        if (error.code === 'PGRST116') return null; // not found
        throw new Error(error.message);
    }
    return data;
}

export async function insertItem(
    input: CreateCategoryInput,
): Promise<Category> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('inventory_item_category')
        .insert(input)
        .select()
        .single();

    if (error) throw new Error(error.message);
    return data;
}

export async function updateItemById(
    id: number,
    input: UpdateCategoryInput,
): Promise<Category> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('inventory_item_category')
        .update({ ...input, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

    if (error) throw new Error(error.message);
    return data;
}

export async function deleteItemById(id: number): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase
        .from('inventory_item_category')
        .delete()
        .eq('id', id);
    if (error) throw new Error(error.message);
}
