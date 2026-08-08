import type { CreateItemUomInput } from '@/service/schema/uom.schema';
import {
    type PaginationParams,
    type PaginatedResult,
} from '@/service/core/pagination';
import { BaseRepository } from '@/service/core/base-repository';
import {
    ApiError,
    ConflictError,
    NotFoundError,
} from '@/service/core/api-response';

import type { RequestContext } from '@/types/request-context';
import { getNextDocumentNumber } from '@/service/core/document-number';
import {
    itemUomBaseFactor,
    type ConversionType,
} from '@/service/core/uom-conversion';

/**
 * A 400 for invalid input. The shared BadRequesstExceptionError is hardcoded to
 * HTTP 404, which would report a validation failure as "not found".
 */
function invalidInput(message: string): ApiError {
    return new ApiError(message, 400, 'VALIDATION_ERROR');
}

export type ItemUom = {
    id: number;
    reference_no: string | null;
    company_id: number | null;
    item_id: number | null;
    user_id: string | null;
    is_default: boolean;
    is_active: boolean;
    uom_id: number;
    conversion: number | null;
    conversion_type: ConversionType;
    /** Generated column: base_qty = entered_qty × base_factor. */
    base_factor: number | null;
    created_at: string;
    writed_at: string;
};

/** An item UOM joined to its UOM master row, for pickers and the editor. */
export type ItemUomWithUom = ItemUom & {
    uom: { id: number; code: string; name: string; display_name: string } | null;
};

const TABLE = 'inventory_item_uom' as const;

/** The line tables that reference an item UOM, for the delete guard. */
const REFERENCING_TABLES = [
    'receipt_items',
    'sales_order_items',
    'sales_shipment_items',
    'stock_adjustment_items',
    'stock_count_items',
] as const;

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

    /** Every UOM defined for an item, base first then by name. */
    async findAllByItem(
        ctx: RequestContext,
        itemId: number,
        params: PaginationParams,
    ): Promise<PaginatedResult<ItemUom>> {
        const query = this.db
            .from(TABLE)
            .select('*, uom:inventory_uom(id, code, name, display_name)', {
                count: 'exact',
            })
            .eq('item_id', itemId)
            .eq('company_id', Number(ctx.companyId))
            .order('is_default', { ascending: false })
            .order('id', { ascending: true });
        return this.paginate(query, params);
    }

    /** Unpaginated list for the UOM Details editor and line pickers. */
    async listByItem(
        ctx: RequestContext,
        itemId: number,
    ): Promise<ItemUomWithUom[]> {
        const { data, error } = await this.db
            .from(TABLE)
            .select('*, uom:inventory_uom(id, code, name, display_name)')
            .eq('item_id', itemId)
            .eq('company_id', Number(ctx.companyId))
            .order('is_default', { ascending: false })
            .order('id', { ascending: true });

        if (error) throw new ApiError(error.message, 500);
        return (data ?? []) as ItemUomWithUom[];
    }

    async findDefaultByItem(
        ctx: RequestContext,
        itemId: number,
    ): Promise<ItemUomWithUom | null> {
        // The unit's name is owned by inventory_uom, so it is always joined —
        // callers that display a unit must never read a denormalised copy.
        const { data, error } = await this.db
            .from(TABLE)
            .select('*, uom:inventory_uom(id, code, name, display_name)')
            .eq('item_id', itemId)
            .eq('company_id', Number(ctx.companyId))
            .eq('is_default', true)
            .maybeSingle();

        if (error) throw new ApiError(error.message, 500);
        return data as ItemUomWithUom | null;
    }

    async findOne(
        ctx: RequestContext,
        id: number,
    ): Promise<ItemUomWithUom | null> {
        const { data, error } = await this.db
            .from(TABLE)
            .select('*, uom:inventory_uom(id, code, name, display_name)')
            .eq('id', id)
            .eq('company_id', Number(ctx.companyId))
            .maybeSingle();

        if (error) throw new ApiError(error.message, 500);
        return data as ItemUomWithUom | null;
    }

    /**
     * Canonical factors for many item UOM ids in one round trip.
     *
     * Document line inserts snapshot the factor per line; without this they
     * would issue one query per line on every save.
     */
    async factorsByIds(
        ctx: RequestContext,
        ids: Array<number | null | undefined>,
    ): Promise<Map<number, number>> {
        const unique = [...new Set(ids.filter((v): v is number => !!v))];
        const out = new Map<number, number>();
        if (unique.length === 0) return out;

        const { data, error } = await this.db
            .from(TABLE)
            .select('id, conversion, conversion_type, base_factor')
            .in('id', unique)
            .eq('company_id', Number(ctx.companyId));

        if (error) throw new ApiError(error.message, 500);
        for (const row of data ?? []) {
            out.set(row.id as number, itemUomBaseFactor(row));
        }
        return out;
    }

    /**
     * Create an additional (non-base) UOM for an item.
     *
     * Rules 3, 4, 5 and 9 are also enforced by database constraints; checking
     * here first turns a raw constraint violation into a readable message.
     */
    async insertOne(
        ctx: RequestContext,
        input: CreateItemUomInput,
    ): Promise<ItemUom> {
        const companyId = await this.assertItemInCompany(ctx, input.item_id);
        await this.assertUomInCompany(ctx, input.uom_id, companyId);

        const conversion = Number(input.conversion ?? 1);
        const conversionType = (input.conversion_type ??
            'MULTIPLY') as ConversionType;

        if (!Number.isFinite(conversion) || conversion <= 0) {
            throw invalidInput('Conversion must be greater than zero.');
        }

        // Rule 3 + 4: the base UOM must not reappear, and no UOM twice.
        const { data: clash } = await this.db
            .from(TABLE)
            .select('id, is_default')
            .eq('item_id', input.item_id)
            .eq('uom_id', input.uom_id)
            .maybeSingle();
        if (clash) {
            throw new ConflictError(
                clash.is_default
                    ? 'That UOM is already the base UOM for this item.'
                    : 'That UOM is already defined for this item.',
            );
        }

        // Rule 2: only the base row may be default, and it is always 1.
        const isDefault = Boolean(input.is_default);
        if (isDefault && (conversion !== 1 || conversionType !== 'MULTIPLY')) {
            throw invalidInput('The base UOM conversion is always 1.');
        }

        // Rule 1: an alternate is meaningless without a base to convert to —
        // with no base row the conversion layer would treat this row as its own
        // base and "5 Box" would resolve to "60 Box" rather than "60 Piece".
        if (!isDefault) {
            const base = await this.findDefaultByItem(ctx, input.item_id);
            if (!base) {
                throw invalidInput(
                    'This item has no base UOM yet. Set its Base UOM on the item before adding other units.',
                );
            }
        }

        const reference_no = await getNextDocumentNumber(
            ctx,
            'item_uom',
            'IUOM',
        );
        const { data, error } = await this.db
            .from(TABLE)
            .insert({
                ...input,
                conversion,
                conversion_type: conversionType,
                reference_no,
                company_id: companyId,
                user_id: ctx.userId,
                created_by: ctx.userId,
                updated_by: ctx.userId,
            })
            .select()
            .single();

        if (error) throw new ApiError(error.message, 500, error.code);
        return data as ItemUom;
    }

    /**
     * Update an item UOM's conversion.
     *
     * `uom_id` is deliberately NOT updatable. Transaction lines reference this
     * row by id, so repointing it at a different unit would silently restate
     * every historical document that used it. Change the conversion (which is
     * snapshotted per line, so history is safe) or add a new row.
     */
    async updateOne(
        ctx: RequestContext,
        id: number,
        input: Partial<CreateItemUomInput>,
    ): Promise<ItemUom> {
        const existing = await this.findOne(ctx, id);
        if (!existing) throw new NotFoundError(`Item UOM ${id} not found`);

        if (input.uom_id != null && input.uom_id !== existing.uom_id) {
            throw invalidInput(
                'The unit of an existing item UOM cannot be changed because historical documents reference it. Add a new UOM instead.',
            );
        }

        const conversion =
            input.conversion != null
                ? Number(input.conversion)
                : Number(existing.conversion ?? 1);
        const conversionType = (input.conversion_type ??
            existing.conversion_type ??
            'MULTIPLY') as ConversionType;

        if (!Number.isFinite(conversion) || conversion <= 0) {
            throw invalidInput('Conversion must be greater than zero.');
        }
        if (existing.is_default && conversion !== 1) {
            throw invalidInput('The base UOM conversion is always 1.');
        }

        // uom_id is intentionally dropped: the guard above already refused a
        // change, and re-sending the same value would be a no-op write.
        const patch = { ...input };
        delete patch.uom_id;
        const { data, error } = await this.db
            .from(TABLE)
            .update({
                ...patch,
                conversion,
                conversion_type: conversionType,
                updated_by: ctx.userId,
            })
            .eq('id', id)
            .eq('company_id', Number(ctx.companyId))
            .select()
            .single();

        if (error) throw new ApiError(error.message, 500, error.code);
        return data as ItemUom;
    }

    /**
     * Delete an item UOM.
     *
     * Rule 10: refused when any document references it, because those lines
     * resolve their unit through this row. The base UOM can never be deleted —
     * it defines what the item's stock is counted in.
     */
    async deleteOne(ctx: RequestContext, id: number): Promise<void> {
        const existing = await this.findOne(ctx, id);
        if (!existing) throw new NotFoundError(`Item UOM ${id} not found`);

        if (existing.is_default) {
            throw new ConflictError(
                'The base UOM cannot be deleted. Change the item’s base UOM instead.',
            );
        }

        const usedIn = await this.findReferencingTable(id);
        if (usedIn) {
            throw new ConflictError(
                `This UOM is used by existing ${usedIn.replace(/_/g, ' ')} and cannot be deleted. Deactivate it instead.`,
            );
        }

        const { error } = await this.db
            .from(TABLE)
            .delete()
            .eq('id', id)
            .eq('company_id', Number(ctx.companyId));
        if (error) throw new ApiError(error.message, 500, error.code);
    }

    /** The first document table referencing this item UOM, if any. */
    private async findReferencingTable(id: number): Promise<string | null> {
        for (const table of REFERENCING_TABLES) {
            const { count, error } = await this.db
                .from(table)
                .select('id', { count: 'exact', head: true })
                .eq('item_uom_id', id);
            if (error) throw new ApiError(error.message, 500);
            if ((count ?? 0) > 0) return table;
        }
        return null;
    }

    /** The item must exist in the caller's company; returns that company id. */
    private async assertItemInCompany(
        ctx: RequestContext,
        itemId: number,
    ): Promise<number> {
        const { data } = await this.db
            .from('inventory_item')
            .select('id, company_id')
            .eq('id', itemId)
            .maybeSingle();

        if (!data) throw new NotFoundError(`Item ${itemId} not found`);

        const own = Number(ctx.companyId);
        if (Number(data.company_id) !== own) {
            // 404, not 403 — do not confirm another tenant's item exists.
            throw new NotFoundError(`Item ${itemId} not found`);
        }
        return own;
    }

    /** Rule 9: the UOM must belong to the same company as the item. */
    private async assertUomInCompany(
        ctx: RequestContext,
        uomId: number,
        companyId: number,
    ): Promise<void> {
        const { data } = await this.db
            .from('inventory_uom')
            .select('id, company_id, is_active')
            .eq('id', uomId)
            .maybeSingle();

        if (!data) throw new NotFoundError(`UOM ${uomId} not found`);
        if (Number(data.company_id) !== companyId) {
            throw new NotFoundError(`UOM ${uomId} not found`);
        }
        if (data.is_active === false) {
            throw invalidInput('That unit of measure is inactive.');
        }
    }

    async deleteByItem(itemId: number): Promise<void> {
        const { error } = await this.db
            .from(TABLE)
            .delete()
            .eq('item_id', itemId);
        if (error) throw new ApiError(error.message, 500);
    }
}
