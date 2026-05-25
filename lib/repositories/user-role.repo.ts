import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
    CreateUserRoleInput,
    UpdateUserRoleInput,
} from '@/lib/validations/user-role.schema';
import {
    PaginatedResult,
    PaginationMixin,
    PaginationParams,
} from '../base/pagination';

export type UserRole = {
    id: number;
    name: string;
    description: string | null;
};

const TABLE = 'user_role' as const;

export class UserRoleRepository extends PaginationMixin {
    private static instance: UserRoleRepository;
    private clientPromise: Promise<SupabaseClient> | null = null;

    private constructor() {
        super();
    }

    static getInstance(): UserRoleRepository {
        if (!UserRoleRepository.instance) {
            UserRoleRepository.instance = new UserRoleRepository();
        }
        return UserRoleRepository.instance;
    }

    private getClient(): Promise<SupabaseClient> {
        if (!this.clientPromise) {
            this.clientPromise = createClient();
        }
        return this.clientPromise;
    }

    async findAll(
        params: PaginationParams = {},
    ): Promise<PaginatedResult<UserRole>> {
        const supabase = await this.getClient();
        const query = supabase.from(TABLE).select('*', { count: 'exact' });
        return this.paginate(query, params);
    }

    async findOne(id: number): Promise<UserRole | null> {
        const supabase = await this.getClient();
        const { data, error } = await supabase
            .from(TABLE)
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            throw new Error(error.message);
        }
        return data;
    }

    async insertOne(input: CreateUserRoleInput): Promise<UserRole> {
        const supabase = await this.getClient();
        const { data, error } = await supabase
            .from(TABLE)
            .insert(input)
            .select()
            .single();

        if (error) throw new Error(error.message);
        return data;
    }

    async updateOne(id: number, input: UpdateUserRoleInput): Promise<UserRole> {
        const supabase = await this.getClient();
        const { data, error } = await supabase
            .from(TABLE)
            .update(input)
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
