import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
    CreateUomInput,
    UpdateUomInput,
} from '@/lib/validations/uom.schema';

export type TUom = {
    id: number;
    name: string;
    created_at: string | null;
    writed_at: string | null;
};

const TABLE = 'inventory_item_uom' as const;

export class UOMRepository {
    private static instance: UOMRepository;

    // Cached per-request Supabase client (React.cache handles dedup)
    private clientPromise: Promise<SupabaseClient> | null = null;

    private constructor() {}

    static getInstance(): UOMRepository {
        if (!UOMRepository.instance) {
            UOMRepository.instance = new UOMRepository();
        }
        return UOMRepository.instance;
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

    async findAll(): Promise<TUom[]> {
        const supabase = await this.getClient();
        const { data, error } = await supabase.from(TABLE).select('*');

        if (error) throw new Error(error.message);
        return data ?? [];
    }

    async findOne(id: number): Promise<TUom | null> {
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

    async insertOne(input: CreateUomInput): Promise<TUom> {
        const supabase = await this.getClient();
        const { data, error } = await supabase
            .from(TABLE)
            .insert(input)
            .select()
            .single();

        if (error) throw new Error(error.message);
        return data;
    }

    async updateOne(id: number, input: UpdateUomInput): Promise<TUom> {
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
