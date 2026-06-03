import type {
    StockLocationCreateInput,
    StockLocationUpdateInput,
} from '@/service/schema/branch.schema';
import { BaseRepository } from '@/service/core/base-repository';
import type { RequestContext } from '@/types/request-context';
import type { StockLocationProps } from '@/types/branch';
import { PaginatedResult, PaginationParams } from '@/service/core/pagination';

const TABLE = 'stock_location' as const;

export class StockLocationRepository extends BaseRepository {
    private static instance: StockLocationRepository;

    static getInstance(): StockLocationRepository {
        if (!StockLocationRepository.instance) {
            StockLocationRepository.instance = new StockLocationRepository();
        }
        return StockLocationRepository.instance;
    }
    async lookupLocations(
        ctx: RequestContext,
        warehouseId?: number,
        params: PaginationParams = { page: 1, limit: 10 },
    ): Promise<PaginatedResult<StockLocationProps>> {

        console.log('Looking up locations with warehouseId:', warehouseId, 'and params:', params);
        let query = this.db
            .from(TABLE)
            .select('*', { count: 'exact' })
            .order('id', { ascending: false });

        if (warehouseId !== undefined) {

            console.log('Filtering locations by warehouse_id:', warehouseId);
            query = query.eq('branch_id', warehouseId);
        }

        return this.paginate(query, params);
    }
    async findAll(
        ctx: RequestContext,
        warehoseId?: number,
    ): Promise<StockLocationProps[]> {
        const { data: warehouses } = await this.db
            .from('warehouse')
            .select('id')
            .eq('company_id', Number(ctx.companyId));

        const branchIds = (warehouses ?? []).map((w: { id: number }) => w.id);
        if (branchIds.length === 0) return [];

        let query = this.db
            .from(TABLE)
            .select('*')
            .in('branch_id', branchIds)
            .eq('is_active', true)
            .order('is_default', { ascending: false })
            .order('name');

        if (warehoseId) query = query.eq('branch_id', warehoseId);

        const { data, error } = await query;
        if (error) throw new Error(error.message);
        return data ?? [];
    }

    async insertOne(
        ctx: RequestContext,
        input: StockLocationCreateInput,
    ): Promise<StockLocationProps> {
        const { data: branch } = await this.db
            .from('warehouse')
            .select('id')
            .eq('id', input.branch_id)
            .eq('company_id', Number(ctx.companyId))
            .single();

        if (!branch) throw new Error('Branch not found or access denied');

        if (input.is_default) {
            await this.db
                .from(TABLE)
                .update({ is_default: false })
                .eq('branch_id', input.branch_id);
        }

        const { data, error } = await this.db
            .from(TABLE)
            .insert({ ...input, is_active: true })
            .select()
            .single();

        if (error) throw new Error(error.message);
        return data;
    }

    async updateOne(
        ctx: RequestContext,
        id: number,
        input: StockLocationUpdateInput,
    ): Promise<StockLocationProps> {
        const { data: target } = await this.db
            .from(TABLE)
            .select('branch_id')
            .eq('id', id)
            .single();

        if (!target) throw new Error('Location not found');

        const { data: branch } = await this.db
            .from('warehouse')
            .select('id')
            .eq('id', target.branch_id)
            .eq('company_id', Number(ctx.companyId))
            .single();

        if (!branch) throw new Error('Access denied');

        if (input.is_default === true) {
            await this.db
                .from(TABLE)
                .update({ is_default: false })
                .eq('branch_id', target.branch_id)
                .neq('id', id);
        }

        const { data, error } = await this.db
            .from(TABLE)
            .update(input)
            .eq('id', id)
            .select()
            .single();

        if (error) throw new Error(error.message);
        return data;
    }

    async deleteOne(ctx: RequestContext, id: number): Promise<void> {
        const { data: target } = await this.db
            .from(TABLE)
            .select('branch_id')
            .eq('id', id)
            .single();

        if (!target) throw new Error('Location not found');

        const { data: branch } = await this.db
            .from('warehouse')
            .select('id')
            .eq('id', target.branch_id)
            .eq('company_id', Number(ctx.companyId))
            .single();

        if (!branch) throw new Error('Access denied');

        const { data: stock } = await this.db
            .from('inventory_stock_balance')
            .select('id')
            .eq('location_id', id)
            .gt('quantity', 0);

        if (stock && stock.length > 0) {
            throw new Error(
                'Location has stock. Transfer it elsewhere before deleting.',
            );
        }

        const { error } = await this.db.from(TABLE).delete().eq('id', id);
        if (error) throw new Error(error.message);
    }
}
