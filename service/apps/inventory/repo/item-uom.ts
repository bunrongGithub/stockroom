import type { CreateUomInput, UpdateUomInput } from '@/service/schema/uom.schema';
import { type PaginationParams, type PaginatedResult } from '@/service/core/pagination';
import { BaseRepository } from '@/service/core/base-repository';
import type { RequestContext } from '@/types/request-context';
import { generateSequenNumbering } from '@/lib/utils/sequenumbering';

export type Uom = {
    id: number;
    name: string;
    reference_no: string | null;
    user_id: string | null;
    company_id: number | null;
};

const TABLE = 'inventory_item_uom' as const;

export class UomRepository extends BaseRepository {
    private static instance: UomRepository;

    private constructor() {
        super();
    }

    static getInstance(): UomRepository {
        if (!UomRepository.instance) {
            UomRepository.instance = new UomRepository();
        }
        return UomRepository.instance;
    }

    async findAll(
        ctx: RequestContext,
        params: PaginationParams,
    ): Promise<PaginatedResult<Uom>> {
        const query = this.applyScope(
            this.db.from(TABLE).select('*', { count: 'exact' }),
            ctx,
        );
        return this.paginate(query, params);
    }

    async findOne(ctx: RequestContext, id: number): Promise<Uom | null> {
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

    async insertOne(ctx: RequestContext, input: CreateUomInput): Promise<Uom> {
        const reference_no = generateSequenNumbering('UOM');
        const { data, error } = await this.scopedDb(Number(ctx.companyId))
            .from(TABLE)
            .insert({ ...input, reference_no })
            .select()
            .single();

        if (error) throw new Error(error.message);
        return data as Uom;
    }

    async updateOne(ctx: RequestContext, id: number, input: UpdateUomInput): Promise<Uom> {
        const { data, error } = await this.applyScope(
            this.db.from(TABLE).update({ ...input }).eq('id', id),
            ctx,
        )
            .select()
            .single();

        if (error) throw new Error(error.message);
        return data as Uom;
    }

    async deleteOne(ctx: RequestContext, id: number): Promise<void> {
        const { error } = await this.applyScope(
            this.db.from(TABLE).delete().eq('id', id),
            ctx,
        );

        if (error) throw new Error(error.message);
    }
}
