import { BaseRepository, type QueryScope } from '@/service/core/base-repository';
import type { QueryConfig } from '@/service/core/query/config.ts';
import type { QueryObject } from '@/service/core/query/types.ts';
import type {
    PaginatedResult,
    PaginationParams,
} from '@/service/core/pagination';
import type { AppModule } from '@/types/app';
import type { RequestContext } from '@/types/request-context';

const TABLE = 'modules' as const;

type ParentRef = { id: number; label: string };

/** One grantable module row as the role permission editor consumes it. */
export type AccessTreeModule = {
    id: number;
    key: string;
    label: string;
    path: string;
    type: string;
    parent_id: number | null;
    sort_order: number;
};

export type AppModuleNested = AppModule & {
    parent: ParentRef | null;
    children: (AppModule & {
        parent: ParentRef | null;
        children: (AppModule & { parent: ParentRef | null })[];
    })[];
};

export class ModuleRepository extends BaseRepository {
    /** The module catalog is global — it has no company_id to scope by. */
    protected readonly scope: QueryScope = 'none';

    /** Query Framework registry. */
    protected readonly queryConfig: QueryConfig = {
        table: TABLE,
        defaultSelect:
            'id, key, label, path, component, parent_id, icon, sort_order, is_active, type, is_initial_data',
        searchable: ['key', 'label', 'path'],
        sortable: ['id', 'key', 'label', 'path', 'type', 'sort_order', 'is_active'],
        filterable: {
            type: {
                type: 'enum',
                values: ['transaction', 'configuration', 'action'],
            },
            is_active: { type: 'boolean' },
            parent_id: { type: 'foreign-key' },
        },
        defaultSort: [{ field: 'sort_order', direction: 'asc' }],
    };

    /**
     * Standardized list path (Query Framework).
     *
     * Action rows are pinned out: they exist only to carry a permission for a
     * verb (approve, post, …) and are managed from the role editor, not here.
     */
    async findAllV2(
        ctx: RequestContext,
        query: QueryObject,
    ): Promise<PaginatedResult<Omit<AppModule, 'permission'>>> {
        return this.findAllQuery<Omit<AppModule, 'permission'>>(ctx, query, {
            forced: [{ column: 'type', operator: 'neq', value: 'action' }],
        });
    }

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
    ): Promise<PaginatedResult<Omit<AppModule, 'permission'>>> {
        const baseQuery = this.db
            .from(TABLE)
            .select(
                'id, key, label, path, component, parent_id, icon, sort_order, is_active, type, is_initial_data, role_module_permission(id, module_id, role_id, roles(id, name, company_id))',
                { count: 'exact' },
            )
            .or('parent_id.is.null,type.eq.transaction');

        if (await this.isSupperUser(_ctx))
            return await this.paginate(baseQuery, params);

        const currentCompanyId = _ctx.companyId;
        const queryByCompany = baseQuery.filter(
            'role_module_permission.roles.company_id',
            'eq',
            currentCompanyId,
        );
        return this.paginate(queryByCompany, params);
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

        let moduleParent: ParentRef | null = null;
        if (module.parent_id != null) {
            const { data: parentRow } = await this.db
                .from(TABLE)
                .select('id, label')
                .eq('id', module.parent_id)
                .single();
            moduleParent = parentRow
                ? {
                      id: parentRow.id as number,
                      label: parentRow.label as string,
                  }
                : { id: module.parent_id, label: '' };
        }

        // Fetch direct children, then fan-out grandchildren in parallel
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

                const gc = (grandchildren ?? []).map((gc) => ({
                    ...gc,
                    parent: { id: child.id, label: child.label },
                }));

                return {
                    ...child,
                    parent: { id: module.id, label: module.label },
                    children: gc,
                };
            }),
        );

        return {
            ...module,
            parent: moduleParent,
            children: childrenWithGrandchildren,
        };
    }

    async insertOne(
        _ctx: RequestContext,
        input: Omit<AppModule, 'id' | 'is_initial_data'> & {
            is_initial_data?: boolean;
        },
    ): Promise<AppModule> {
        const { permission, ...newInput } = input;
        console.log(permission);
        const { data, error } = await this.db
            .from(TABLE)
            .insert({
                ...newInput,
                is_initial_data: input.is_initial_data ?? false,
            })
            .select('*')
            .single();

        if (error) {
            throw new Error(error.message);
        }

        // create assign the perm to the created user

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

    /**
     * Every grantable module, flat, for the role permission editor.
     *
     * Modules are global (no company_id), so this is deliberately not
     * tenant-filtered — and it must NOT be filtered by existing grants either,
     * or a role could never be given access to something it does not already
     * have. Action rows are excluded because their grants are derived from
     * their parent's on save.
     */
    async findAccessTree(_ctx: RequestContext): Promise<AccessTreeModule[]> {
        const { data, error } = await this.db
            .from(TABLE)
            .select('id, key, label, path, type, parent_id, sort_order')
            .neq('type', 'action')
            .eq('is_active', true)
            .order('sort_order', { ascending: true });

        if (error) throw new Error(error.message);
        return (data ?? []) as AccessTreeModule[];
    }

    async findAllMenu(
        _ctx: RequestContext,
        params: PaginationParams,
    ): Promise<PaginatedResult<Omit<AppModule, 'permission'>>> {
        const baseQuery = this.db
            .from(TABLE)
            .select(
                'id, key, label, path, component, parent_id, icon, sort_order, is_active, type, is_initial_data, role_module_permission(id, module_id, role_id, roles(id, name, company_id))',
                { count: 'exact' },
            );

        if (await this.isSupperUser(_ctx))
            return await this.paginate(baseQuery, params);

        const currentCompanyId = _ctx.companyId;
        const queryByCompany = baseQuery.filter(
            'role_module_permission.roles.company_id',
            'eq',
            currentCompanyId,
        );
        return this.paginate(queryByCompany, params);
    }
}
