import type {
    BranchCreateInput,
    BranchUpdateInput,
} from '@/service/schema/branch.schema';
import {
    BaseRepository,
    type WithAuditUsers,
} from '@/service/core/base-repository';
import type { RequestContext } from '@/types/request-context';
import type { Warehouse } from '@/types/branch';
import { PaginatedResult, PaginationParams } from '@/service/core';
import { ApiError } from '@/service/core/api-response';
import { PostgrestError } from '@supabase/supabase-js';

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
    ): Promise<PaginatedResult<Warehouse>> {
        const query = this.applyFilter(
            this.db.from(TABLE).select('*', { count: 'exact' }),
            ctx,
        );

        const result = await this.paginate(query, params);
        return result;
    }

    async findAll(
        ctx: RequestContext,
        params: PaginationParams,
    ): Promise<PaginatedResult<Warehouse>> {
        const isSuperUser = await this.isSupperUser(ctx);

        const baseQuery = this.db
            .from(TABLE)
            .select('*,company(id,name)', { count: 'exact' })
            .order('id', { ascending: false });

        if (isSuperUser) return this.paginate(baseQuery, params);

        const query = this.applyCompanyFilter(baseQuery, Number(ctx.companyId));
        return this.paginate(query, params);
    }

    async findOne(
        context: RequestContext,
        id: number,
    ): Promise<WithAuditUsers<Warehouse> | null> {
        const baseQuery = this.db
            .from(TABLE)
            .select('*,warehouse_location(*)')
            .eq('id', id)
            .maybeSingle();

        const isSuperUser = await this.isSupperUser(context);
        if (isSuperUser) {
            const { data, error } = await baseQuery;
            if (error && error instanceof PostgrestError) {
                throw new ApiError(error.message);
            }
            return data ? this.enrichAuditOne(data) : null;
        }
        const { data, error } = await this.applyCompanyFilter(
            baseQuery,
            parseInt(context.companyId),
        );
        if (error && error instanceof PostgrestError) {
            throw new ApiError(error.message);
        }
        return data ? this.enrichAuditOne(data) : null;
    }

    async insertOne(
        ctx: RequestContext,
        input: BranchCreateInput,
    ): Promise<Warehouse> {
        const supabase = this.db;

        if (input.is_default) {
            await supabase
                .from(TABLE)
                .update(this.stampUpdate(ctx, { is_default: false }))
                .eq('company_id', Number(ctx.companyId));
        }

        const { data, error } = await supabase
            .from(TABLE)
            .insert(
                this.stampCreate(ctx, {
                    ...input,
                    company_id: Number(ctx.companyId),
                }),
            )
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
    ): Promise<Warehouse> {
        const supabase = this.db;

        if (input.is_default === true) {
            await supabase
                .from(TABLE)
                .update(this.stampUpdate(ctx, { is_default: false }))
                .eq('company_id', Number(ctx.companyId))
                .neq('id', id);
        }

        const { data, error } = await supabase
            .from(TABLE)
            .update(this.stampUpdate(ctx, input))
            .eq('id', id)
            .eq('company_id', Number(ctx.companyId))
            .select()
            .single();

        if (error) throw new Error(error.message);
        return data;
    }

    async syncLocations(
        warehouseId: number,
        locations: Array<{
            id?: number;
            name: string;
            code?: string | null;
            description?: string | null;
            is_active: boolean;
            is_default: boolean;
        }>,
        removedIds: number[],
    ): Promise<void> {
        const supabase = this.db;

        if (removedIds.length > 0) {
            await supabase
                .from('warehouse_location')
                .delete()
                .in('id', removedIds);
        }

        for (const loc of locations) {
            if (loc.id) {
                await supabase
                    .from('warehouse_location')
                    .update({
                        name: loc.name,
                        code: loc.code ?? null,
                        description: loc.description ?? null,
                        is_active: loc.is_active,
                        is_default: loc.is_default,
                    })
                    .eq('id', loc.id)
                    .eq('warehouse_id', warehouseId);
            } else {
                await supabase.from('warehouse_location').insert({
                    warehouse_id: warehouseId,
                    name: loc.name,
                    code: loc.code ?? null,
                    description: loc.description ?? null,
                    is_active: loc.is_active,
                    is_default: loc.is_default,
                });
            }
        }
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
