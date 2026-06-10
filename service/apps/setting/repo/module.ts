import { BaseRepository } from '@/service/core/base-repository';
import type {
    PaginatedResult,
    PaginationParams,
} from '@/service/core/pagination';
import type { AppModule } from '@/types/app';
import type { RequestContext } from '@/types/request-context';

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
        const query = this.applyFilter(
            this.db
                .from(TABLE)
                .select(
                    'id, key, label, path, component, parent_id, icon, sort_order, is_active, type',
                    { count: 'exact' },
                )
                ,
            ctx,
        );
        return this.paginate(query, params);
    }

    async findOne(ctx: RequestContext, id: number): Promise<AppModule | null> {
        const { data, error } = await this.applyFilter(
            this.db
                .from(TABLE)
                .select(
                    'id, key, label, path, component, parent_id, icon, sort_order, is_active, type, permission',
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
