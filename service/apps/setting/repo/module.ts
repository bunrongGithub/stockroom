import { BaseRepository } from '@/service/core/base-repository';
import type {
    PaginatedResult,
    PaginationParams,
} from '@/service/core/pagination';
import type { AppModule } from '@/types/app';
import type { RequestContext } from '@/types/request-context';

const TABLE = 'modules' as const;

export type AppModuleNested = AppModule & {
    children: (AppModule & { children: AppModule[] })[];
};

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
        _ctx: RequestContext,
        params: PaginationParams,
    ): Promise<PaginatedResult<AppModule>> {
        const query = this.applyFilter(
            this.db
                .from(TABLE)
                .select(
                    'id, key, label, path, component, parent_id, icon, sort_order, is_active, type, is_initial_data',
                    { count: 'exact' },
                )
                .is('parent_id', null),
            _ctx,
        );
        return this.paginate(query, params);
    }

    async findOne(
        _ctx: RequestContext,
        id: number,
    ): Promise<AppModuleNested | null> {
        const { data: module, error } = await this.db
            .from(TABLE)
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            throw new Error(error.message);
        }

        // Fetch direct children in one query, then fan-out grandchildren in parallel
        const { data: directChildren } = await this.db
            .from(TABLE)
            .select('*')
            .eq('parent_id', id)
            .order('sort_order', { ascending: true });

        const children = directChildren ?? [];

        const childrenWithGrandchildren = await Promise.all(
            children.map(async (child: AppModule) => {
                const { data: grandchildren } = await this.db
                    .from(TABLE)
                    .select('*')
                    .eq('parent_id', child.id)
                    .order('sort_order', { ascending: true });
                return { ...child, children: grandchildren ?? [] };
            }),
        );

        return { ...module, children: childrenWithGrandchildren };
    }

    async insertOne(
        _ctx: RequestContext,
        input: Omit<AppModule, 'id' | 'is_initial_data'> & {
            is_initial_data?: boolean;
        },
    ): Promise<AppModule> {
        const { data, error } = await this.db
            .from(TABLE)
            .insert({
                ...input,
                is_initial_data: input.is_initial_data ?? false,
            })
            .select('*')
            .single();

        if (error) throw new Error(error.message);
        return data as AppModule;
    }

    async updateOne(
        _ctx: RequestContext,
        id: number,
        input: Partial<Omit<AppModule, 'id'>>,
    ): Promise<AppModule> {
        const { data, error } = await this.db
            .from(TABLE)
            .update(input)
            .eq('id', id)
            .select('*')
            .single();

        if (error) throw new Error(error.message);
        return data as AppModule;
    }

    async deleteOne(_ctx: RequestContext, id: number): Promise<void> {
        const { error } = await this.db.from(TABLE).delete().eq('id', id);
        if (error) throw new Error(error.message);
    }

    async findAllMenu(_ctx: RequestContext, params: PaginationParams): Promise<PaginatedResult<AppModule>> {
        const { limit = 10, page = 1, search } = params;
        const query = this.applyFilter(
            this.db
                .from(TABLE)
                .select(
                    'id, key, label, path, component, parent_id, icon, sort_order, is_active, type, is_initial_data',
                    { count: 'exact' },
                ),
            _ctx,
        ).order('sort_order', { ascending: true });
        return this.paginate(query, { limit, page, search, searchColumn: 'label' });
    }
}
