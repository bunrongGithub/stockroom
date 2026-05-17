import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
    CreateInventoryInput,
    UpdateInventoryInput,
} from '../validations/inventory.schema';

export type InventoryProduct = {
    id: number;
    name: string;
    reference_no: string;
};

const TABLE = 'inventory_item' as const;

export class InventoryProductRepository {
    private static instance: InventoryProductRepository;
    private clientPromise: Promise<SupabaseClient> | null = null;

    private constructor() {}

    static getInstance(): InventoryProductRepository {
        if (!InventoryProductRepository.instance) {
            InventoryProductRepository.instance =
                new InventoryProductRepository();
        }
        return InventoryProductRepository.instance;
    }

    private getClient(): Promise<SupabaseClient> {
        if (!this.clientPromise) {
            this.clientPromise = createClient();
        }
        return this.clientPromise;
    }
    async findAll(): Promise<InventoryProduct[]> {
        const supabase = await this.getClient();

        const { data, error } = await supabase.from(TABLE).select(`
            *,
            category:category_id (
                id,
                name
            ),
            uom:uom_id (
                id,
                name
            )
        `);

        if (error) throw new Error(error.message);

        return data ?? [];
    }

    async findOne(id: number): Promise<InventoryProduct | null> {
        const supabase = await this.getClient();
        const { data, error } = await supabase
            .from(TABLE)
            .select(
                `
            *,
            category:category_id (
                id,
                name
            ),
            uom:uom_id (
                id,
                name
            )
        `,
            )
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

    async insertOne(input: CreateInventoryInput): Promise<InventoryProduct> {
        const supabase = await this.getClient();
        const { data, error } = await supabase
            .from(TABLE)
            .insert(input)
            .select()
            .single();

        if (error) throw new Error(error.message);
        return data;
    }

    async updateOne(
        id: number,
        input: UpdateInventoryInput,
    ): Promise<InventoryProduct> {
        const supabase = await this.getClient();
        const { data, error } = await supabase
            .from(TABLE)
            .update({ ...input, updated_at: new Date().toISOString() })
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
