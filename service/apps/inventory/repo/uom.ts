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

    /**
     * Row scope for the caller: `null` for super users (no company filter),
     * otherwise the caller's company id. NOTE: deliberately not a
     * query-wrapping async helper — an async function that returns a Supabase
     * builder makes the promise adopt the thenable and execute the query
     * immediately, breaking any further chaining.
     */
    private async companyScope(ctx: RequestContext): Promise<number | null> {
        if (await this.isSupperUser(ctx)) return null;
        return Number(ctx.companyId);
    }

    async findAll(
        ctx: RequestContext,
        params: PaginationParams & { activeOnly?: boolean },
    ): Promise<PaginatedResult<InventoryUom>> {
        const {
            search,
            sortBy = 'name',
            sortOrder = 'asc',
            activeOnly,
        } = params;

        let baseQuery = this.db
            .from(VIEW)
            .select('*', { count: 'exact' })
            .order(sortBy, { ascending: sortOrder === 'asc' });
        if (activeOnly) baseQuery = baseQuery.eq('is_active', true);

        // Multi-column search across code / name / symbol / description.
        if (search?.trim()) {
            const q = search.trim().replace(/[%,]/g, '');
            baseQuery = baseQuery.or(
                `code.ilike.%${q}%,name.ilike.%${q}%,display_name.ilike.%${q}%,description.ilike.%${q}%`,
            );
        }

        const scope = await this.companyScope(ctx);
        if (scope !== null) {
            baseQuery = this.applyCompanyFilter(baseQuery, scope);
        }
        return this.paginate(baseQuery, params);
    }

    async findOne(
        ctx: RequestContext,
        id: number,
    ): Promise<InventoryUom | null> {
        let query = this.db.from(VIEW).select('*').eq('id', id);

        const scope = await this.companyScope(ctx);
        if (scope !== null) query = this.applyCompanyFilter(query, scope);

        const { data, error } = await query.single();
        if (error) {
            if (error.code === 'PGRST116') return null;
            throw new Error(error.message);
        }
        return data as InventoryUom;
    }

    /** Reference counts across every table that FKs inventory_uom(id). */
    async getUsage(ctx: RequestContext, id: number): Promise<UomUsage> {
        const scope = await this.companyScope(ctx);

        const countOf = async (
            table: string,
            build: (q: unknown) => unknown,
        ): Promise<number> => {
            let query = this.db
                .from(table)
                .select('id', { count: 'exact', head: true });
            if (scope !== null) query = this.applyCompanyFilter(query, scope);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { count } = (await build(query)) as any;
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
        let query = this.db
            .from('inventory_item')
            .select('id, name, sku')
            .eq('uom_id', id);

        const scope = await this.companyScope(ctx);
        if (scope !== null) query = this.applyCompanyFilter(query, scope);

        const { data, error } = await query
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
            let query = this.db.from(TABLE).update(rest).eq('id', id);

            const scope = await this.companyScope(ctx);
            if (scope !== null) query = this.applyCompanyFilter(query, scope);

            const { error } = await query;
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
        // findOne enforces the caller's scope (non-super users can only reach
        // their own company's UOMs). Both statements below are then pinned to
        // the TARGET UOM's company — never unscoped — so a super user acting
        // on another company's UOM can't clear defaults across all tenants.
        const target = await this.findOne(ctx, id);
        if (!target) throw new Error('UOM not found');

        // Clear existing default(s) first to satisfy the partial-unique index.
        const { error: clearErr } = await this.db
            .from(TABLE)
            .update({ is_default: false })
            .eq('company_id', target.company_id)
            .eq('is_default', true)
            .neq('id', id);
        if (clearErr) throw new Error(clearErr.message);

        const { data, error } = await this.db
            .from(TABLE)
            .update({ is_default: true })
            .eq('id', id)
            .eq('company_id', target.company_id)
            .select()
            .single();
        if (error) throw new Error(error.message);
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

        let query = this.db.from(TABLE).delete().eq('id', id);

        const scope = await this.companyScope(ctx);
        if (scope !== null) query = this.applyCompanyFilter(query, scope);

        const { error } = await query;
        if (error) throw new Error(error.message);
    }
}
