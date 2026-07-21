import { generateSKU } from '@/lib/utils/sequenumbering';
import { NotFoundError } from '@/service/core/api-response';
import { BaseRepository } from '@/service/core/base-repository';
import { behaviorOf } from '@/service/core/item-behavior';
import { getNextDocumentNumber } from '@/service/core/document-number';
import {
    type PaginatedResult,
    type PaginationParams,
} from '@/service/core/pagination';
import type {
    CreateInventoryInput,
    UpdateInventoryInput,
} from '@/service/schema/inventory.schema';
import type { QueryConfig } from '@/service/core/query/config.ts';
import type { QueryObject } from '@/service/core/query/types.ts';
import type { RequestContext } from '@/types/request-context';
import type { AuditMeta } from '@/types/audit';
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

    /**
     * Query Framework registry. Relations mirror SELECT_COLS; `category_name`
     * demonstrates joined-entity filtering (embedded with !inner only while
     * the filter is active, so uncategorized items still list otherwise).
     */
    protected readonly queryConfig: QueryConfig = {
        table: TABLE,
        searchable: ['name', 'sku', 'reference_no', 'description'],
        sortable: ['name', 'sku', 'reference_no', 'price', 'cost', 'created_at', 'updated_at'],
        filterable: {
            item_class: { type: 'text' },
            is_sellable: { type: 'boolean' },
            is_variant: { type: 'boolean' },
            track_serial: { type: 'boolean' },
            price: { type: 'number' },
            cost: { type: 'number' },
            category_id: { type: 'foreign-key' },
            uom_id: { type: 'foreign-key' },
            created_at: { type: 'date' },
            updated_at: { type: 'date' },
            category_name: { type: 'text', relation: 'category', column: 'name' },
        },
        relations: {
            category: {
                table: 'inventory_item_category',
                columns: ['id', 'name', 'reference_no'],
                always: true,
            },
            company: { table: 'company', columns: ['id', 'name'], always: true },
            uom: {
                table: 'inventory_uom',
                columns: ['id', 'name', 'display_name'],
                always: true,
            },
            default_warehouse: {
                table: 'warehouse',
                columns: ['id', 'name'],
                always: true,
            },
            default_location: {
                table: 'warehouse_location',
                columns: ['id', 'name'],
                always: true,
            },
        },
        defaultSort: [{ field: 'id', direction: 'desc' }],
    };

    /**
     * Standardized list path for one item class. The class is pinned
     * server-side (`forced`) so a client filter can never widen it.
     */
    async findAllByClassV2(
        ctx: RequestContext,
        query: QueryObject,
        itemClass: 'stock' | 'non_stock' | 'service',
    ): Promise<PaginatedResult<InventoryItem>> {
        return this.findAllQuery<InventoryItem>(ctx, query, {
            forced: [{ column: 'item_class', operator: 'eq', value: itemClass }],
        });
    }

    /**
     * Unified item lookup across every class — the endpoint sale pickers use,
     * so non-stock and service items are offered alongside stock. Rows carry
     * item_class for behavior routing and badges.
     */
    async findAllV2(
        ctx: RequestContext,
        query: QueryObject,
    ): Promise<PaginatedResult<InventoryItem>> {
        return this.findAllQuery<InventoryItem>(ctx, query);
    }

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
        params: PaginationParams & { sellableOnly?: boolean },
        itemClass: 'stock' | 'non_stock' | 'service',
    ): Promise<PaginatedResult<InventoryItem>> {
        const isSuperUser = await this.isSupperUser(ctx);

        let query = this.db
            .from(TABLE)
            .select(SELECT_COLS, { count: 'exact' })
            .eq('item_class', itemClass)
            .order('id', { ascending: false });

        // `is_sellable` means "can be sold through any sales channel" (Sales
        // Order, Cash Sale, POS…). Sales pickers ask for sellable items only;
        // the item-master list still shows everything.
        if (params.sellableOnly) {
            query = query.eq('is_sellable', true);
        }

        if (isSuperUser) return await this.paginate(query, params);

        return await this.paginate(
            this.applyCompanyFilter(query, Number(ctx.companyId)),
            params,
        );
    }

    async findOne(
        ctx: RequestContext,
        id: number,
    ): Promise<(InventoryItem & Partial<AuditMeta>) | null> {
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
        return data ? this.enrichAuditOne(data) : null;
    }

    async insertOne(
        ctx: RequestContext,
        input: CreateInventoryInput,
    ): Promise<InventoryItem> {
        if (
            input.track_serial &&
            !behaviorOf(input.item_class ?? 'stock').supportsSerial
        ) {
            throw new Error(
                'Serial tracking is only supported for stock items',
            );
        }

        // Reference numbers come from the document-number framework (atomic,
        // per company × doc_type counter) — never generated in the repo.
        // Non-stock and service items share the stock counter's shape but keep
        // their own sequence, so numbers stay contiguous per class.
        const docType =
            input.item_class === 'non_stock' ? 'non_stock_item'
            : input.item_class === 'service' ? 'service_item'
            : 'stock_item';
        const docPrefix =
            input.item_class === 'non_stock' ? 'NSTK'
            : input.item_class === 'service' ? 'SRVC'
            : 'STCK';
        const referenceNo = await getNextDocumentNumber(ctx, docType, docPrefix);
        const sku = input.sku ? input.sku : generateSKU('SKU');

        const { data, error } = await this.scopedDb(Number(ctx.companyId))
            .from(TABLE)
            .insert(
                this.stampCreate(ctx, {
                    ...input,
                    user_id: ctx.userId,
                    reference_no: referenceNo,
                    sku,
                }),
            )
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
                .update(this.stampUpdate(ctx, { ...input }))
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
