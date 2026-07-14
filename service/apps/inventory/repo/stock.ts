import { generateSKU } from '@/lib/utils/sequenumbering';
import { NotFoundError } from '@/service/core/api-response';
import { BaseRepository } from '@/service/core/base-repository';
import { getNextDocumentNumber } from '@/service/core/document-number';
import {
    type PaginatedResult,
    type PaginationParams,
} from '@/service/core/pagination';
import type {
    CreateInventoryInput,
    UpdateInventoryInput,
} from '@/service/schema/inventory.schema';
import type { RequestContext } from '@/types/request-context';
import { ItemUomRepository } from './item-uom';
import { InventoryUomRepository } from './uom';

export type InventoryItem = {
    id: number;
    name: string;
    reference_no: string | null;
    sku: string | null;
    description: string | null;
    item_class: string;
    price: number;
    min_price: number | null;
    max_price: number | null;
    cost: number | null;
    is_variant: boolean;
    is_discount: boolean;
    is_sellable: boolean;
    is_returnable: boolean;
    is_warranty: boolean;
    track_serial: boolean;
    warranty_duration: string | null;
    category_id: number | null;
    uom_id: number | null;
    user_id: string | null;
    company_id: number | null;
    created_at: string;
    updated_at: string;
    default_warehouse_id: number | null;
    default_location_id: number | null;
    default_warehouse: { id: number; name: string } | null;
    default_location: { id: number; name: string } | null;
    category: { id: number; name: string; reference_no: string } | null;
    uom: { id: number; name: string } | null;
    company: { id: number; name: string } | null;
};

const TABLE = 'inventory_item' as const;
const SELECT_COLS =
    '*, category:inventory_item_category(id, name, reference_no), company:company(id, name), uom:inventory_uom(id, name, display_name), default_warehouse:warehouse(id, name), default_location:warehouse_location(id, name)';

export class InventoryRepository extends BaseRepository {
    private static instance: InventoryRepository;

    private constructor() {
        super();
    }

    static getInstance(): InventoryRepository {
        if (!InventoryRepository.instance) {
            InventoryRepository.instance = new InventoryRepository();
        }
        return InventoryRepository.instance;
    }

    async findAll(
        ctx: RequestContext,
        params: PaginationParams,
    ): Promise<PaginatedResult<InventoryItem>> {
        const isSuperUser = await this.isSupperUser(ctx);
        const query = this.applyFilter(
            this.db.from(TABLE).select(SELECT_COLS, { count: 'exact' }),
            ctx,
            isSuperUser,
        ).order('id', { ascending: false });
        return this.paginate(query, params);
    }

    async findAllByClass(
        ctx: RequestContext,
        params: PaginationParams,
        itemClass: 'stock' | 'non_stock' | 'service',
    ): Promise<PaginatedResult<InventoryItem>> {
        const isSuperUser = await this.isSupperUser(ctx);

        const query = this.db
            .from(TABLE)
            .select(SELECT_COLS, { count: 'exact' })
            .eq('item_class', itemClass)
            .order('id', { ascending: false });

        if (isSuperUser) return await this.paginate(query, params);

        return await this.paginate(
            this.applyCompanyFilter(query, Number(ctx.companyId)),
            params,
        );
    }

    async findOne(
        ctx: RequestContext,
        id: number,
    ): Promise<InventoryItem | null> {
        const isSuperUser = await this.isSupperUser(ctx);
        const { data, error } = await this.applyFilter(
            this.db.from(TABLE).select(SELECT_COLS).eq('id', id),
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
        input: CreateInventoryInput,
    ): Promise<InventoryItem> {
        if (input.item_class !== 'stock' && input.track_serial) {
            throw new Error(
                'Serial tracking is only supported for stock items',
            );
        }

        // Reference numbers come from the document-number framework (atomic,
        // per company × doc_type counter) — never generated in the repo.
        // Non-stock and service items share the stock counter's shape but keep
        // their own sequence, so numbers stay contiguous per class.
        const isNonStock = input.item_class === 'non_stock';
        const referenceNo = await getNextDocumentNumber(
            ctx,
            isNonStock ? 'non_stock_item' : 'stock_item',
            isNonStock ? 'NSTK' : 'STCK',
        );
        const sku = input.sku ? input.sku : generateSKU('SKU');

        const { data, error } = await this.scopedDb(Number(ctx.companyId))
            .from(TABLE)
            .insert({
                ...input,
                user_id: ctx.userId,
                reference_no: referenceNo,
                sku,
            })
            .select()
            .single();

        if (error) throw new Error(error.message);

        const uomService = InventoryUomRepository.getInstance();
        if (input.uom_id) {
            const uom = await uomService.findOne(ctx, input.uom_id);

            if (!uom)
                throw new NotFoundError(
                    `Uom found for the given id: ${input.uom_id}`,
                ).toResponse();

            // create new inventory item uom
            const defaultFactor = 1;
            const defaultConversion = 1;
            await ItemUomRepository.getInstance().insertOne(ctx, {
                name: uom.name,
                display_name: uom.display_name,
                item_id: data.id,
                uom_id: uom.id,
                is_default: true,
                conversion: defaultConversion,
                factor: defaultFactor,
            });
        }

        return data as InventoryItem;
    }

    async updateOne(
        ctx: RequestContext,
        id: number,
        input: UpdateInventoryInput,
    ): Promise<InventoryItem> {
        const itemUomService = ItemUomRepository.getInstance();
        const uomService = InventoryUomRepository.getInstance();
        const isSuperUser = await this.isSupperUser(ctx);

        const stockItem = await this.findOne(ctx, id);

        if (!stockItem)
            throw new NotFoundError(
                `Stock item not found for the given id: ${id}`,
            ).toResponse();

        // Guard on the EFFECTIVE class: a partial update may omit item_class,
        // so fall back to the item's current class before allowing track_serial.
        const effectiveClass = input.item_class ?? stockItem.item_class;
        if (input.track_serial && effectiveClass !== 'stock') {
            throw new Error(
                'Serial tracking is only supported for stock items',
            );
        }

        // update item
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

        // sync the base (default) uom whenever a uom is provided
        if (input.uom_id) {
            const uom = await uomService.findOne(ctx, input.uom_id);

            if (!uom)
                throw new NotFoundError(
                    `Uom not found for the given id: ${input.uom_id}`,
                ).toResponse();

            const baseUom = await itemUomService.findDefaultByItem(
                ctx,
                stockItem.id,
            );

            if (!baseUom) {
                // no base uom yet -> create one
                await itemUomService.insertOne(ctx, {
                    name: uom.name,
                    display_name: uom.display_name,
                    item_id: stockItem.id,
                    uom_id: uom.id,
                    is_default: true,
                    conversion: 1,
                    factor: 1,
                });
            } else if (baseUom.uom_id !== uom.id) {
                // base uom changed -> point the existing default at the new uom
                await itemUomService.updateOne(ctx, baseUom.id, {
                    name: uom.name,
                    display_name: uom.display_name,
                    uom_id: uom.id,
                    conversion: 1,
                    factor: 1,
                });
            }
        }

        return data as InventoryItem;
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
