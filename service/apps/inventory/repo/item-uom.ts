import type { CreateItemUomInput } from '@/service/schema/uom.schema';
import { type PaginationParams, type PaginatedResult } from '@/service/core/pagination';
import { BaseRepository } from '@/service/core/base-repository';
import type { RequestContext } from '@/types/request-context';
import { getNextDocumentNumber } from '@/service/core/document-number';

export type ItemUom = {
    id: number;
    reference_no: string | null;
    name: string;
    display_name: string | null;
    company_id: number | null;
    item_id: number | null;
    user_id: string | null;
    is_default: boolean;
    uom_id: number;
    conversion: number | null;
    factor: number | null;
    created_at: string;
    writed_at: string;
};

const TABLE = 'inventory_item_uom' as const;

export class ItemUomRepository extends BaseRepository {
    private static instance: ItemUomRepository;

    private constructor() {
        super();
    }

    static getInstance(): ItemUomRepository {
        if (!ItemUomRepository.instance) {
            ItemUomRepository.instance = new ItemUomRepository();
        }
        return ItemUomRepository.instance;
    }

    async findAllByItem(
        ctx: RequestContext,
        itemId: number,
        params: PaginationParams,
    ): Promise<PaginatedResult<ItemUom>> {
        const query = this.db
            .from(TABLE)
            .select('*', { count: 'exact' })
            .eq('item_id', itemId)
            .eq('company_id', Number(ctx.companyId));
        return this.paginate(query, params);
    }

    async findDefaultByItem(
        ctx: RequestContext,
        itemId: number,
    ): Promise<ItemUom | null> {
        const { data, error } = await this.db
            .from(TABLE)
            .select('*')
            .eq('item_id', itemId)
            .eq('company_id', Number(ctx.companyId))
            .eq('is_default', true)
            .maybeSingle();

        if (error) throw new Error(error.message);
        return data as ItemUom | null;
    }

    async findOne(ctx: RequestContext, id: number): Promise<ItemUom | null> {
        const { data, error } = await this.db
            .from(TABLE)
            .select('*')
            .eq('id', id)
            .eq('company_id', Number(ctx.companyId))
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            throw new Error(error.message);
        }
        return data as ItemUom;
    }

    async insertOne(ctx: RequestContext, input: CreateItemUomInput): Promise<ItemUom> {
        const reference_no = await getNextDocumentNumber(ctx, 'item_uom', 'IUOM');
        const { data, error } = await this.db
            .from(TABLE)
            .insert({
                ...input,
                reference_no,
                company_id: Number(ctx.companyId),
                user_id: ctx.userId,
            })
            .select()
            .single();

        if (error) throw new Error(error.message);
        return data as ItemUom;
    }

    async updateOne(
        ctx: RequestContext,
        id: number,
        input: Partial<CreateItemUomInput>,
    ): Promise<ItemUom> {
        const { data, error } = await this.db
            .from(TABLE)
            .update({ ...input })
            .eq('id', id)
            .eq('company_id', Number(ctx.companyId))
            .select()
            .single();

        if (error) throw new Error(error.message);
        return data as ItemUom;
    }

    async deleteByItem(itemId: number): Promise<void> {
        const { error } = await this.db
            .from(TABLE)
            .delete()
            .eq('item_id', itemId);
        if (error) throw new Error(error.message);
    }
}
