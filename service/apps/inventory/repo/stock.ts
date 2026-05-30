import type { CreateInventoryInput, UpdateInventoryInput } from '@/service/schema/inventory.schema';
import { type PaginationParams, type PaginatedResult } from '@/service/core/pagination';
import { BaseRepository } from '@/service/core/base-repository';
import type { RequestContext } from '@/types/request-context';

export type InventoryItem = {
    id: number;
    name: string;
    reference_no: string | null;
    sku: string | null;
    price: number;
    sale_price: number;
    purchase_price: number;
    stock: number | null;
    category_id: number | null;
    uom_id: number | null;
    is_variant: boolean;
    is_discount: boolean;
    item_class: string;
    images_url: string[] | null;
    user_id: string | null;
    company_id: number | null;
    created_at: string;
    updated_at: string;
};

const TABLE = 'inventory_item' as const;

export class InventoryRepository extends BaseRepository {
    private static instance: InventoryRepository;

    private constructor() {
        super();
    }

    static getInstance(): InventoryRepository {
        if (!InventoryRepository.instance) {
            InventoryRepository.instance = new InventoryRepository();
        }
        return InventoryRepository.instance;
    }

    async findAll(
        ctx: RequestContext,
        params: PaginationParams,
    ): Promise<PaginatedResult<InventoryItem>> {
        const query = this.applyScope(
            this.db.from(TABLE).select('*', { count: 'exact' }),
            ctx,
        );
        return this.paginate(query, params);
    }

    async findOne(ctx: RequestContext, id: number): Promise<InventoryItem | null> {
        const { data, error } = await this.applyScope(
            this.db.from(TABLE).select('*').eq('id', id),
            ctx,
        ).single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            throw new Error(error.message);
        }
        return data;
    }

    async insertOne(ctx: RequestContext, input: CreateInventoryInput): Promise<InventoryItem> {
        const { data, error } = await this.scopedDb(Number(ctx.companyId))
            .from(TABLE)
            .insert({ ...input, user_id: ctx.userId })
            .select()
            .single();

        if (error) throw new Error(error.message);
        return data as InventoryItem;
    }

    async updateOne(
        ctx: RequestContext,
        id: number,
        input: UpdateInventoryInput,
    ): Promise<InventoryItem> {
        const { data, error } = await this.applyScope(
            this.db.from(TABLE).update({ ...input, updated_at: new Date().toISOString() }).eq('id', id),
            ctx,
        )
            .select()
            .single();

        if (error) throw new Error(error.message);
        return data as InventoryItem;
    }

    async deleteOne(ctx: RequestContext, id: number): Promise<void> {
        const { error } = await this.applyScope(
            this.db.from(TABLE).delete().eq('id', id),
            ctx,
        );

        if (error) throw new Error(error.message);
    }
}
