import type {
    CreateInventoryUomInput,
    UpdateInventoryUomInput,
} from '@/service/schema/inventory-uom.schema';
import {
    type PaginationParams,
    type PaginatedResult,
} from '@/service/core/pagination';
import { BaseRepository } from '@/service/core/base-repository';
import { ConflictError } from '@/service/core/api-response';
import type { RequestContext } from '@/types/request-context';

export type InventoryUom = {
    id: number;
    code: string;
    name: string;
    display_name: string;
    description: string | null;
    is_active: boolean;
    is_default: boolean;
    company_id: number;
    created_by: string | null;
    created_at: string;
    updated_at: string | null;
    wrated_at?: string | null;
    /** Number of inventory items using this UOM (from the usage view). */
    item_count?: number;
};

export type UomUsage = {
    item_count: number;
    item_uom_count: number;
    movement_count: number;
    total: number;
    in_use: boolean;
};

export type UomItemRef = { id: number; name: string; sku: string | null };

const TABLE = 'inventory_uom' as const;
const VIEW = 'inventory_uom_usage' as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isUniqueViolation(e: any): boolean {
    return e?.code === '23505';
}

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
        params: PaginationParams & { activeOnly?: boolean },
    ): Promise<PaginatedResult<InventoryUom>> {
        const { search, sortBy = 'name', sortOrder = 'asc', activeOnly } = params;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let query: any = this.scopeQuery(
            this.db.from(VIEW).select('*', { count: 'exact' }),
            ctx,
        );

        if (activeOnly) query = query.eq('is_active', true);

        // Multi-column search across code / name / symbol / description.
        if (search?.trim()) {
            const q = search.trim().replace(/[%,]/g, '');
            query = query.or(
                `code.ilike.%${q}%,name.ilike.%${q}%,display_name.ilike.%${q}%,description.ilike.%${q}%`,
            );
        }

        query = query.order(sortBy, { ascending: sortOrder === 'asc' });

        // Search already applied above — don't let paginate re-apply searchColumn.
        return this.paginate(query, { ...params, search: undefined });
    }

    async findOne(ctx: RequestContext, id: number): Promise<InventoryUom | null> {
        const { data, error } = await this.scopeQuery(
            this.db.from(VIEW).select('*').eq('id', id),
            ctx,
        ).single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            throw new Error(error.message);
        }
        return data as InventoryUom;
    }

    /** Reference counts across every table that FKs inventory_uom(id). */
    async getUsage(ctx: RequestContext, id: number): Promise<UomUsage> {
        const countOf = async (
            table: string,
            build: (q: unknown) => unknown,
        ): Promise<number> => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { count } = (await build(
                this.db.from(table).select('id', { count: 'exact', head: true }),
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            )) as any;
            return count ?? 0;
        };

        const [item_count, item_uom_count, movement_count] = await Promise.all([
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            countOf('inventory_item', (q: any) => q.eq('uom_id', id)),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            countOf('inventory_item_uom', (q: any) => q.eq('uom_id', id)),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            countOf('inventory_movement_items', (q: any) =>
                q.or(`entered_uom_id.eq.${id},base_uom_id.eq.${id}`),
            ),
        ]);

        const total = item_count + item_uom_count + movement_count;
        return {
            item_count,
            item_uom_count,
            movement_count,
            total,
            in_use: total > 0,
        };
    }

    /** Items using this UOM, for the detail page. */
    async getItemsUsing(
        ctx: RequestContext,
        id: number,
        limit = 50,
    ): Promise<UomItemRef[]> {
        const { data, error } = await this.scopeQuery(
            this.db
                .from('inventory_item')
                .select('id, name, sku')
                .eq('uom_id', id),
            ctx,
        )
            .order('name', { ascending: true })
            .limit(limit);
        if (error) throw new Error(error.message);
        return (data ?? []) as UomItemRef[];
    }

    async insertOne(
        ctx: RequestContext,
        input: CreateInventoryUomInput,
    ): Promise<InventoryUom> {
        const companyId = Number(ctx.companyId);
        const { is_default, ...rest } = input;

        const { data, error } = await this.scopedDb(companyId)
            .from(TABLE)
            .insert({ ...rest, is_default: false, created_by: ctx.userId })
            .select()
            .single();

        if (error) {
            if (isUniqueViolation(error)) {
                throw new ConflictError(
                    'A unit of measure with this code or name already exists.',
                );
            }
            throw new Error(error.message);
        }
        const created = data as InventoryUom;

        // Honor "make default" after insert so the one-default rule is enforced
        // through the same path as an update.
        if (is_default) return this.setDefault(ctx, created.id);
        return created;
    }

    async updateOne(
        ctx: RequestContext,
        id: number,
        input: UpdateInventoryUomInput,
    ): Promise<InventoryUom> {
        const { is_default, ...rest } = input;

        if (Object.keys(rest).length > 0) {
            const { error } = await this.scopeQuery(
                this.db.from(TABLE).update(rest).eq('id', id),
                ctx,
            );
            if (error) {
                if (isUniqueViolation(error)) {
                    throw new ConflictError(
                        'A unit of measure with this code or name already exists.',
                    );
                }
                throw new Error(error.message);
            }
        }

        if (is_default === true) return this.setDefault(ctx, id);

        const updated = await this.findOne(ctx, id);
        if (!updated) throw new Error('UOM not found');
        return updated;
    }

    /** Make one UOM the company default, clearing any previous default. */
    async setDefault(ctx: RequestContext, id: number): Promise<InventoryUom> {
        const companyId = Number(ctx.companyId);
        // Clear existing default(s) first to satisfy the partial-unique index.
        const { error: clearErr } = await this.scopeQuery(
            this.db
                .from(TABLE)
                .update({ is_default: false })
                .eq('is_default', true)
                .neq('id', id),
            ctx,
        );
        if (clearErr) throw new Error(clearErr.message);

        const { data, error } = await this.scopeQuery(
            this.db.from(TABLE).update({ is_default: true }).eq('id', id),
            ctx,
        )
            .select()
            .single();
        if (error) throw new Error(error.message);
        void companyId;
        return data as InventoryUom;
    }

    async deleteOne(ctx: RequestContext, id: number): Promise<void> {
        const usage = await this.getUsage(ctx, id);
        if (usage.in_use) {
            const parts: string[] = [];
            if (usage.item_count) parts.push(`${usage.item_count} item(s)`);
            if (usage.item_uom_count)
                parts.push(`${usage.item_uom_count} item-UOM setup(s)`);
            if (usage.movement_count)
                parts.push(`${usage.movement_count} movement line(s)`);
            throw new ConflictError(
                `This unit of measure is used by ${parts.join(', ')}. Set it Inactive instead of deleting.`,
            );
        }

        const { error } = await this.scopeQuery(
            this.db.from(TABLE).delete().eq('id', id),
            ctx,
        );
        if (error) throw new Error(error.message);
    }
}
