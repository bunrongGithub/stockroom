import type {
    BranchCreateInput,
    BranchUpdateInput,
} from '@/service/schema/branch.schema';
import { BaseRepository } from '@/service/core/base-repository';
import type { RequestContext } from '@/types/request-context';
import type { BranchProps } from '@/types/branch';
import { PaginatedResult, PaginationParams } from '@/service/core';

const TABLE = 'warehouse' as const;

export class WarehouseRepository extends BaseRepository {
    private static instance: WarehouseRepository;

    static getInstance(): WarehouseRepository {
        if (!WarehouseRepository.instance) {
            WarehouseRepository.instance = new WarehouseRepository();
        }
        return WarehouseRepository.instance;
    }

    async lookupWarehouse(
        ctx: RequestContext,
        params: PaginationParams = { page: 1, limit: 10 },
    ): Promise<PaginatedResult<BranchProps>> {
        const query = this.applyScope(
            this.db.from(TABLE).select('*', { count: 'exact' }),
            ctx,
        );

        const result = await this.paginate(query, params);
        return result;
    }

    async findAll(ctx: RequestContext): Promise<BranchProps[]> {
        const supabase = this.db;
        const { data, error } = await supabase
            .from(TABLE)
            .select('*, stock_location(*)')
            .eq('company_id', Number(ctx.companyId))
            .order('is_default', { ascending: false })
            .order('name');

        if (error) throw new Error(error.message);
        return data ?? [];
    }

    async findOne(
        ctx: RequestContext,
        id: number,
    ): Promise<BranchProps | null> {
        const supabase = this.db;
        const { data, error } = await supabase
            .from(TABLE)
            .select('*, stock_location(*)')
            .eq('id', id)
            .eq('company_id', Number(ctx.companyId))
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            throw new Error(error.message);
        }
        return data;
    }

    async insertOne(
        ctx: RequestContext,
        input: BranchCreateInput,
    ): Promise<BranchProps> {
        const supabase = this.db;

        if (input.is_default) {
            await supabase
                .from(TABLE)
                .update({ is_default: false })
                .eq('company_id', Number(ctx.companyId));
        }

        const { data, error } = await supabase
            .from(TABLE)
            .insert({ ...input, company_id: Number(ctx.companyId) })
            .select()
            .single();

        if (error) throw new Error(error.message);

        await supabase.from('stock_location').insert({
            branch_id: data.id,
            name: 'Main Storage',
            code: 'MAIN',
            is_default: true,
            is_active: true,
        });

        await supabase.from('user_branch').insert({
            user_id: ctx.userId,
            branch_id: data.id,
            role: 'owner',
        });

        return data;
    }

    async updateOne(
        ctx: RequestContext,
        id: number,
        input: BranchUpdateInput,
    ): Promise<BranchProps> {
        const supabase = this.db;

        if (input.is_default === true) {
            await supabase
                .from(TABLE)
                .update({ is_default: false })
                .eq('company_id', Number(ctx.companyId))
                .neq('id', id);
        }

        const { data, error } = await supabase
            .from(TABLE)
            .update(input)
            .eq('id', id)
            .eq('company_id', Number(ctx.companyId))
            .select()
            .single();

        if (error) throw new Error(error.message);
        return data;
    }

    async deleteOne(ctx: RequestContext, id: number): Promise<void> {
        const supabase = this.db;

        const { data: locs } = await supabase
            .from('stock_location')
            .select('id')
            .eq('branch_id', id);

        if (locs && locs.length > 0) {
            const locationIds = locs.map((l) => l.id);
            const { data: stock } = await supabase
                .from('inventory_stock_balance')
                .select('id')
                .in('location_id', locationIds)
                .gt('quantity', 0);

            if (stock && stock.length > 0) {
                throw new Error(
                    'Cannot delete branch with stock on hand. Transfer stock out first.',
                );
            }
        }

        const { error } = await supabase
            .from(TABLE)
            .delete()
            .eq('id', id)
            .eq('company_id', Number(ctx.companyId));

        if (error) throw new Error(error.message);
    }
}
