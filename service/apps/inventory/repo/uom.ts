import type {
    CreateInventoryUomInput,
    UpdateInventoryUomInput,
} from '@/service/schema/inventory-uom.schema';
import {
    type PaginationParams,
    type PaginatedResult,
} from '@/service/core/pagination';
import { BaseRepository } from '@/service/core/base-repository';
import type { RequestContext } from '@/types/request-context';

export type InventoryUom = {
    id: number;
    name: string;
    display_name: string;
    company_id: number;
    created_at: string;
    wrated_at: string | null;
};

const TABLE = 'inventory_uom' as const;

export class InventoryUomRepository extends BaseRepository {
    private static instance: InventoryUomRepository;

    private constructor() {
        super();
    }

    static getInstance(): InventoryUomRepository {
        if (!InventoryUomRepository.instance) {
            InventoryUomRepository.instance = new InventoryUomRepository();
        }
        return InventoryUomRepository.instance;
    }

    private scopeQuery<T>(query: T, ctx: RequestContext): T {
        if (['super_admin', 'super_user'].includes(ctx.role ?? '')) return query;
        return this.applyCompanyFilter(query, Number(ctx.companyId));
    }

    async findAll(
        ctx: RequestContext,
        params: PaginationParams,
    ): Promise<PaginatedResult<InventoryUom>> {
        const query = this.scopeQuery(
            this.db.from(TABLE).select('*', { count: 'exact' }),
            ctx,
        );
        return this.paginate(query, params);
    }

    async findOne(ctx: RequestContext, id: number): Promise<InventoryUom | null> {
        const { data, error } = await this.scopeQuery(
            this.db.from(TABLE).select('*').eq('id', id),
            ctx,
        ).single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            throw new Error(error.message);
        }
        return data as InventoryUom;
    }

    async insertOne(
        ctx: RequestContext,
        input: CreateInventoryUomInput,
    ): Promise<InventoryUom> {
        const { data, error } = await this.scopedDb(Number(ctx.companyId))
            .from(TABLE)
            .insert({ ...input })
            .select()
            .single();

        if (error) throw new Error(error.message);
        return data as InventoryUom;
    }

    async updateOne(
        ctx: RequestContext,
        id: number,
        input: UpdateInventoryUomInput,
    ): Promise<InventoryUom> {
        const { data, error } = await this.scopeQuery(
            this.db.from(TABLE).update({ ...input, wrated_at: new Date().toISOString() }).eq('id', id),
            ctx,
        )
            .select()
            .single();

        if (error) throw new Error(error.message);
        return data as InventoryUom;
    }

    async deleteOne(ctx: RequestContext, id: number): Promise<void> {
        const { error } = await this.scopeQuery(
            this.db.from(TABLE).delete().eq('id', id),
            ctx,
        );
        if (error) throw new Error(error.message);
    }
}
