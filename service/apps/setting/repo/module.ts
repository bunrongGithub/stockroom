import type { PaginationParams, PaginatedResult } from '@/service/core/pagination';
import { BaseRepository } from '@/service/core/base-repository';
import type { RequestContext } from '@/types/request-context';
import type { AppModule } from '@/types/app';

const TABLE = 'modules' as const;

export class ModuleRepository extends BaseRepository {
    private static instance: ModuleRepository;

    private constructor() {
        super();
    }

    static getInstance(): ModuleRepository {
        if (!ModuleRepository.instance) {
            ModuleRepository.instance = new ModuleRepository();
        }
        return ModuleRepository.instance;
    }

    async findAll(
        ctx: RequestContext,
        params: PaginationParams,
    ): Promise<PaginatedResult<AppModule>> {
        const query = this.applyScope(
            this.db
                .from(TABLE)
                .select(
                    'id, key, label, path, component, parent_id, icon, sort_order, is_active, type',
                    { count: 'exact' },
                ),
            ctx,
        );
        return this.paginate(query, params);
    }

    async findOne(ctx: RequestContext, id: number): Promise<AppModule | null> {
        const { data, error } = await this.applyScope(
            this.db
                .from(TABLE)
                .select(
                    'id, key, label, path, component, parent_id, icon, sort_order, is_active, type',
                )
                .eq('id', id),
            ctx,
        ).single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            throw new Error(error.message);
        }
        return data;
    }
}
