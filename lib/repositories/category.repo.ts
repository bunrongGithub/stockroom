import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
    CreateCategoryInput,
    UpdateCategoryInput,
} from '@/lib/validations/category.schema';

export type Category = {
    id: number;
    name: string;
    reference_no: string;
};

const TABLE = 'inventory_item_category' as const;

export class CategoryRepository {
    private static instance: CategoryRepository;

    // Cached per-request Supabase client (React.cache handles dedup)
    private clientPromise: Promise<SupabaseClient> | null = null;

    private constructor() {}

    static getInstance(): CategoryRepository {
        if (!CategoryRepository.instance) {
            CategoryRepository.instance = new CategoryRepository();
        }
        return CategoryRepository.instance;
    }

    // -------------------------------------------------------------------------
    // Internal helper — resolves the Supabase client once per request
    // -------------------------------------------------------------------------

    private getClient(): Promise<SupabaseClient> {
        if (!this.clientPromise) {
            this.clientPromise = createClient();
        }
        return this.clientPromise;
    }

    // -------------------------------------------------------------------------
    // Query methods
    // -------------------------------------------------------------------------

    async findAll(): Promise<Category[]> {
        const supabase = await this.getClient();
        const { data, error } = await supabase.from(TABLE).select('*');

        if (error) throw new Error(error.message);
        return data ?? [];
    }

    async findOne(id: number): Promise<Category | null> {
        const supabase = await this.getClient();
        const { data, error } = await supabase
            .from(TABLE)
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null; // row not found
            throw new Error(error.message);
        }
        return data;
    }

    // -------------------------------------------------------------------------
    // Mutation methods
    // -------------------------------------------------------------------------

    async insertOne(input: CreateCategoryInput): Promise<Category> {
        const supabase = await this.getClient();
        const { data, error } = await supabase
            .from(TABLE)
            .insert(input)
            .select()
            .single();

        if (error) throw new Error(error.message);
        return data;
    }

    async updateOne(id: number, input: UpdateCategoryInput): Promise<Category> {
        const supabase = await this.getClient();
        const { data, error } = await supabase
            .from(TABLE)
            .update({ ...input })
            .eq('id', id)
            .select()
            .single();

        if (error) throw new Error(error.message);
        return data;
    }

    async deleteOne(id: number): Promise<void> {
        const supabase = await this.getClient();
        const { error } = await supabase.from(TABLE).delete().eq('id', id);

        if (error) throw new Error(error.message);
    }
}
