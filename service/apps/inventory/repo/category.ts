import type {
    CreateCategoryInput,
    UpdateCategoryInput,
} from '@/service/schema/category.schema';
import {
    type PaginationParams,
    type PaginatedResult,
} from '@/service/core/pagination';
import { BaseRepository } from '@/service/core/base-repository';
import type { RequestContext } from '@/types/request-context';
import { getNextDocumentNumber } from '@/service/core/document-number';

export type Category = {
    id: number;
    name: string;
    reference_no: string | null;
    user_id: string | null;
    company_id: number | null;
};

const TABLE = 'inventory_item_category' as const;

export class CategoryRepository extends BaseRepository {
    private static instance: CategoryRepository;

    private constructor() {
        super();
    }

    static getInstance(): CategoryRepository {
        if (!CategoryRepository.instance) {
            CategoryRepository.instance = new CategoryRepository();
        }
        return CategoryRepository.instance;
    }

    async findAll(
        ctx: RequestContext,
        params: PaginationParams,
    ): Promise<PaginatedResult<Category>> {
        const isSuperUser = await this.isSupperUser(ctx);
        const query = this.applyFilter(
            this.db.from(TABLE).select('*', { count: 'exact' }),
            ctx,
            isSuperUser,
        );
        return this.paginate(query, params);
    }

    async findOne(ctx: RequestContext, id: number): Promise<Category | null> {
        const isSuperUser = await this.isSupperUser(ctx);
        const { data, error } = await this.applyFilter(
            this.db.from(TABLE).select('*').eq('id', id),
            ctx,
            isSuperUser,
        ).single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            throw new Error(error.message);
        }
        return data;
    }

    async insertOne(
        ctx: RequestContext,
        input: CreateCategoryInput,
    ): Promise<Category> {
        const referenceNo = await getNextDocumentNumber(ctx, 'item_category', 'C');
        const insertData = { ...input, reference_no: referenceNo };
        const { data, error } = await this.scopedDb(Number(ctx.companyId))
            .from(TABLE)
            .insert({ ...insertData, user_id: ctx.userId })
            .select()
            .single();

        if (error) throw new Error(error.message);
        return data as Category;
    }

    async updateOne(
        ctx: RequestContext,
        id: number,
        input: UpdateCategoryInput,
    ): Promise<Category> {
        // read only reference_no
        const sequenNumberingKey = 'reference_no';
        if (input.reference_no) delete input[sequenNumberingKey];

        const isSuperUser = await this.isSupperUser(ctx);
        const { data, error } = await this.applyFilter(
            this.db
                .from(TABLE)
                .update({ ...input })
                .eq('id', id),
            ctx,
            isSuperUser,
        )
            .select()
            .single();

        if (error) throw new Error(error.message);
        return data as Category;
    }

    async deleteOne(ctx: RequestContext, id: number): Promise<void> {
        const isSuperUser = await this.isSupperUser(ctx);
        const { error } = await this.applyFilter(
            this.db.from(TABLE).delete().eq('id', id),
            ctx,
            isSuperUser,
        );

        if (error) throw new Error(error.message);
    }
}
