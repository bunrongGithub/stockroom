import type {
    CreateCategoryInput,
    UpdateCategoryInput,
} from '@/lib/validations/category.schema';
import { PaginationMixin } from '@/service/core/pagination';
import type { SupabaseClient } from '@supabase/supabase-js';
export type Category = {
    id: number;
    name: string;
    reference_no: string;
    user_id: string | null;
    company_id: number | null;
};

const TABLE = 'inventory_item_category' as const;

export class CategoryRepository extends PaginationMixin {
    private static instance: CategoryRepository;

    // Cached per-request Supabase client (React.cache handles dedup)
    private clientPromise: Promise<SupabaseClient> | null = null;

    private constructor() {
        super();
    }

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

    async findAll(
        params: PaginationParams = {},
    ): Promise<PaginatedResult<Category>> {
        const supabase = await this.getClient();
        const query = supabase.from(TABLE).select('*', { count: 'exact' });
        return this.paginate(query, params);
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

        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const { data: profile } = await supabase
            .from('profiles')
            .select('company_id')
            .eq('id', user.id)
            .single();

        if (!profile) throw new Error('User profile not found');

        const { data, error } = await supabase
            .from(TABLE)
            .insert({
                ...input,
                user_id: user.id,
                company_id: profile.company_id,
            })
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
