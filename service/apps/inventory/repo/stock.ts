import type {
    CreateInventoryInput,
    UpdateInventoryInput,
} from '@/service/schema/inventory.schema';
import {
    type PaginationParams,
    type PaginatedResult,
} from '@/service/core/pagination';
import { BaseRepository } from '@/service/core/base-repository';
import type { RequestContext } from '@/types/request-context';
import {
    generateSequenNumbering,
    generateSKU,
} from '@/lib/utils/sequenumbering';

export type InventoryItem = {
    id: number;
    name: string;
    reference_no: string | null;
    sku: string | null;
    description: string | null;
    item_class: string;
    price: number;
    min_price: number | null;
    max_price: number | null;
    cost: number | null;
    is_variant: boolean;
    is_discount: boolean;
    is_sellable: boolean;
    is_returnable: boolean;
    is_warranty: boolean;
    warranty_duration: string | null;
    category_id: number | null;
    uom_id: number | null;
    user_id: string | null;
    company_id: number | null;
    created_at: string;
    updated_at: string;
    category: { id: number; name: string; reference_no: string } | null;
    uom: { id: number; name: string } | null;
    company: { id: number; name: string } | null;
};

const TABLE = 'inventory_item' as const;
const SELECT_COLS = '*, category:inventory_item_category(id, name, reference_no), company:company(id, name)';

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
        const query = this.applyFilter(
            this.db.from(TABLE).select(SELECT_COLS, { count: 'exact' }),
            ctx,
        ).order('id', { ascending: false });
        return this.paginate(query, params);
    }

    async findAllByClass(
        ctx: RequestContext,
        params: PaginationParams,
        itemClass: 'stock' | 'non_stock' | 'service',
    ): Promise<PaginatedResult<InventoryItem>> {
        const query = this.applyFilter(
            this.db.from(TABLE).select(SELECT_COLS, { count: 'exact' }),
            ctx,
        )
            .eq('item_class', itemClass)
            .order('id', { ascending: false });
        return this.paginate(query, params);
    }

    async findOne(
        ctx: RequestContext,
        id: number,
    ): Promise<InventoryItem | null> {
        const { data, error } = await this.applyFilter(
            this.db.from(TABLE).select(SELECT_COLS).eq('id', id),
            ctx,
        ).single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            throw new Error(error.message);
        }
        return data;
    }

    async insertOne(
        ctx: RequestContext,
        input: CreateInventoryInput,
    ): Promise<InventoryItem> {
        const prefix = input.item_class === 'non_stock' ? 'NSTK' : 'STCK';
        const referenceNo = generateSequenNumbering(prefix);
        const sku = input.sku ? input.sku : generateSKU('SKU');

        const { data, error } = await this.scopedDb(Number(ctx.companyId))
            .from(TABLE)
            .insert({
                ...input,
                user_id: ctx.userId,
                reference_no: referenceNo,
                sku,
            })
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
        const { data, error } = await this.applyFilter(
            this.db
                .from(TABLE)
                .update({ ...input })
                .eq('id', id),
            ctx,
        )
            .select()
            .single();

        if (error) throw new Error(error.message);
        return data as InventoryItem;
    }

    async deleteOne(ctx: RequestContext, id: number): Promise<void> {
        const { error } = await this.applyFilter(
            this.db.from(TABLE).delete().eq('id', id),
            ctx,
        );

        if (error) throw new Error(error.message);
    }
}
