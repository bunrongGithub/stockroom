import { getNextDocumentNumber } from '@/service/core/document-number';
import {
    ApiError,
    BadRequesstExceptionError,
    NotFoundError,
} from '@/service/core/api-response';
import { BaseRepository } from '@/service/core/base-repository';
import type { QueryConfig } from '@/service/core/query/config.ts';
import type { QueryObject } from '@/service/core/query/types.ts';
import type {
    PaginatedResult,
    PaginationParams,
} from '@/service/core/pagination';
import type {
    CreateReceiptInput,
    CreateReceiptLineInput,
    UpdateReceiptInput,
} from '@/service/schema/receipt.schema';
import type { RequestContext } from '@/types/request-context';
import type { AuditMeta } from '@/types/audit';
import {
    itemUomBaseFactor,
    toBaseQty,
    uomContextOf,
} from '@/service/core/uom-conversion';
import { ItemUomRepository } from './item-uom';
import { MovementRepository } from './movement';
import { SerialManagementService } from '@/service/apps/inventory/serial';

// ─── Types ────────────────────────────────────────────────────────────────────
export type InventoryTxnMovementType =
    | 'receipt'
    | 'issue'
    | 'transfer'
    | 'adjustment'
    | 'SALE_SHIPMENT'
    | 'SALE_RETURN';

export type InventoryMovemtTypeReasonMeta =
    | 'Goods received from a supplier after a purchase order'
    | 'Customer returned goods back to the warehouse'
    | 'Goods received from another warehouse';
export type ReceiptItemType = {
    id: number;
    receipt_id: number;
    item_id: number;
    warehouse_id: number;
    location_id: number;
    uom_id: number;
    item_uom_id: number | null;
    receipt_qty: number;
    serial_numbers?: string[];
    conversion_factor: number;
    base_qty_received: number;
    lot_number: string | null;
    purchased_date: string | null;
    unit_cost: number | null;
    created_at: string;
    updated_at: string;
    // Enriched via FK embeds in findOne() — not raw columns
    item?: { id: number; name: string } | null;
    warehouse?: { id: number; name: string } | null;
    location?: { id: number; name: string } | null;
    item_uom?: { id: number; name: string; display_name: string | null } | null;
};

export type ReceiptCreatedBy = {
    id: string;
    full_name: string | null;
};

/** Status-derived capability flags, injected per row so the UI can gate actions. */
export type ReceiptActions = {
    can_update: boolean;
    can_post: boolean;
    can_void: boolean;
};

/**
 * Only DRAFT receipts can be edited, posted, or voided — POSTED and VOID
 * receipts are immutable. Mirrors the guards in updateOne/postReceipt/voidReceipt.
 */
export function computeReceiptActions(
    status: ReceiptTxnType['status'],
): ReceiptActions {
    const isDraft = status === 'DRAFT';
    return { can_update: isDraft, can_post: isDraft, can_void: isDraft };
}

export type ReceiptTxnType = {
    id: number;
    company_id: number;
    company: { id: number; name: string };
    user_id: string;
    reference_no: string;
    /** User-entered reference (supplier invoice / PO) — never generated */
    source_reference_no: string | null;
    received_date: string;
    status: 'DRAFT' | 'POSTED' | 'VOID';
    notes: string | null;
    transaction_date: string;
    movement_type: InventoryTxnMovementType;
    created_at: string;
    updated_at: string;
    items?: ReceiptItemType[];
    reason: InventoryMovemtTypeReasonMeta;
    // Enriched after fetch — not a DB column
    created_by: ReceiptCreatedBy | null;
    // Computed capability flags — not a DB column
    actions?: ReceiptActions;
};

type PostReceiptResult = { ok: boolean; receipt_id?: number; error?: string };

// ─── Constants ────────────────────────────────────────────────────────────────

const HEADER_TABLE = 'receipt_transaction' as const;
const LINE_TABLE = 'receipt_items' as const;
// Note: no `created_by:profiles(...)` embed here. Since the audit framework
// added created_by + updated_by FKs to profiles there are now THREE relationships
// between receipt_transaction and profiles, so a bare `profiles` embed is
// ambiguous (PGRST201). The creator is resolved through the shared batched
// enricher (enrichAudit) instead, which also yields created_by_user/updated_by_user.
const SELECT_LIST = '*, company(id, name)';
const SELECT_DETAIL =
    '*, company(id, name), items:receipt_items(*, item:inventory_item(id, name), warehouse:warehouse(id, name), location:warehouse_location(id, name), item_uom:inventory_item_uom(id, uom:inventory_uom(id, name, display_name)))';

// ─── Repository ───────────────────────────────────────────────────────────────

/**
 * Owns the line items of a single receipt.
 *
 * Init with the raw line inputs, then attach them to a saved receipt header:
 *
 *   const lines = new ReceiptItemRepository(input.items);
 *   await lines.createForReceipt(ctx, header);
 */
export class ReceiptItemRepository extends BaseRepository {
    constructor(private readonly items: CreateReceiptLineInput[]) {
        super();
    }

    /** Resolve the UOM for each line and insert the rows for `receipt`. */
    async createForReceipt(
        ctx: RequestContext,
        receipt: ReceiptTxnType,
    ): Promise<ReceiptItemType[]> {
        const itemUomService = ItemUomRepository.getInstance();

        const rows = await Promise.all(
            this.items.map(async (item) => {
                const itemUom = await itemUomService.findOne(
                    ctx,
                    item.item_uom_id as number,
                );
                if (!itemUom) {
                    throw new NotFoundError(
                        `item uom not found with the given id: ${item.item_uom_id}`,
                    );
                }

                return {
                    receipt_id: receipt.id,
                    item_id: item.item_id,
                    warehouse_id: item.warehouse_id,
                    location_id: item.location_id,
                    item_uom_id: itemUom.id,
                    receipt_qty: item.receipt_qty,
                    // Snapshot the conversion in force at save time. Editing
                    // the item's UOM later must not restate this receipt.
                    conversion_factor: itemUomBaseFactor(itemUom),
                    lot_number: item.lot_number ?? null,
                    purchased_date: item.purchased_date ?? null,
                    unit_cost: item.unit_cost ?? null,
                    serial_numbers: item.serial_numbers ?? [],
                };
            }),
        );

        // Serial numbers are persisted on the line (JSONB input carrier) but the
        // inventory_serial records are only created when the receipt is POSTED
        // (see ReceiptRepository.postReceipt) — i.e. when stock actually exists.
        const { data, error } = await this.db
            .from(LINE_TABLE)
            .insert(rows)
            .select();

        if (error) throw new ApiError(error.message, 500);
        return data as ReceiptItemType[];
    }
}

export class ReceiptRepository extends BaseRepository {
    private static instance: ReceiptRepository;

    /** Query Framework registry. */
    protected readonly queryConfig: QueryConfig = {
        table: HEADER_TABLE,
        searchable: ['reference_no', 'source_reference_no'],
        sortable: [
            'reference_no',
            'received_date',
            'transaction_date',
            'status',
            'created_at',
        ],
        filterable: {
            status: { type: 'enum', values: ['DRAFT', 'POSTED', 'VOID'] },
            received_date: { type: 'date' },
            transaction_date: { type: 'date' },
            created_at: { type: 'date' },
        },
        relations: {
            company: { table: 'company', columns: ['id', 'name'], always: true },
        },
        defaultSort: [{ field: 'id', direction: 'desc' }],
    };

    /** Standardized list path (Query Framework). */
    async findAllV2(
        ctx: RequestContext,
        query: QueryObject,
    ): Promise<PaginatedResult<ReceiptTxnType>> {
        const result = await this.findAllQuery<
            ReceiptTxnType & { created_by?: string | null }
        >(ctx, query);
        // Resolve created_by → creator profile for the list's "Created By"
        // column in ONE batched query (no N+1).
        const enriched = await this.enrichAudit(result.data);
        return {
            ...result,
            data: enriched.map((row) => ({
                ...row,
                created_by: row.created_by_user,
                actions: computeReceiptActions(row.status),
            })),
        };
    }

    static getInstance(): ReceiptRepository {
        if (!ReceiptRepository.instance) {
            ReceiptRepository.instance = new ReceiptRepository();
        }
        return ReceiptRepository.instance;
    }

    async findAll(
        ctx: RequestContext,
        params: PaginationParams,
    ): Promise<PaginatedResult<ReceiptTxnType>> {
        const isSuperUser = await this.isSupperUser(ctx);
        let query = this.applyFilter(
            this.db.from(HEADER_TABLE).select(SELECT_LIST, { count: 'exact' }),
            ctx,
            isSuperUser,
        ).order('id', { ascending: false });
        // Search matches the system number OR the user reference number.
        if (params.search) {
            query = query.or(
                `reference_no.ilike.%${params.search}%,source_reference_no.ilike.%${params.search}%`,
            );
        }
        const result = await this.paginate<ReceiptTxnType>(query, {
            ...params,
            search: undefined,
            searchColumn: undefined,
        });
        // Resolve created_by → creator profile for the list's "Created By"
        // column in ONE batched query (no N+1).
        const enriched = await this.enrichAudit(
            result.data as Array<
                ReceiptTxnType & { created_by?: string | null }
            >,
        );
        return {
            ...result,
            data: enriched.map((row) => ({
                ...row,
                created_by: row.created_by_user,
                actions: computeReceiptActions(row.status),
            })),
        };
    }

    async findOne(
        ctx: RequestContext,
        id: number,
    ): Promise<(ReceiptTxnType & Partial<AuditMeta>) | null> {
        const isSuperUser = await this.isSupperUser(ctx);
        const { data, error } = await this.applyFilter(
            this.db.from(HEADER_TABLE).select(SELECT_DETAIL).eq('id', id),
            ctx,
            isSuperUser,
        ).maybeSingle();

        if (error) throw new ApiError(error.message, 500);
        if (!data) return null;
        const receipt = data as ReceiptTxnType & {
            created_by?: string | null;
            updated_by?: string | null;
        };
        const enriched = await this.enrichAuditOne({
            ...receipt,
            actions: computeReceiptActions(receipt.status),
            created_by: receipt.created_by ?? null,
            updated_by: receipt.updated_by ?? null,
        });
        // Keep the legacy `created_by` shape (creator profile object) that the
        // receipt detail UI reads; the card uses created_by_user/updated_by_user.
        return { ...enriched, created_by: enriched.created_by_user };
    }

    async insertOne(
        ctx: RequestContext,
        input: CreateReceiptInput,
    ): Promise<ReceiptTxnType> {
        const reference_no = await getNextDocumentNumber(ctx, 'inventory_receipt');
        const { items, ...header } = input;

        const { data: headerData, error: headerError } = await this.db
            .from(HEADER_TABLE)
            .insert(
                this.stampCreate(ctx, {
                    ...header,
                    reference_no,
                    status: 'DRAFT',
                    company_id: Number(ctx.companyId),
                    user_id: ctx.userId,
                }),
            )
            .select()
            .single();

        if (headerError) throw new ApiError(headerError.message, 500);

        // Attach the line items to the freshly created header. If anything
        // fails (missing UOM, insert error) roll the header back so we never
        // leave an orphan receipt behind.
        try {
            const lines = new ReceiptItemRepository(items);
            await lines.createForReceipt(ctx, headerData as ReceiptTxnType);
        } catch (err) {
            await this.db.from(HEADER_TABLE).delete().eq('id', headerData.id);
            throw err;
        }

        return (await this.findOne(ctx, headerData.id))!;
    }

    async updateOne(
        ctx: RequestContext,
        id: number,
        input: UpdateReceiptInput,
    ): Promise<ReceiptTxnType> {
        const existing = await this.findOne(ctx, id);
        if (!existing) throw new NotFoundError('Receipt not found');
        if (existing.status !== 'DRAFT') {
            throw new ApiError(
                'Only DRAFT receipts can be edited',
                400,
                'INVALID_STATUS',
            );
        }

        const { items, ...header } = input;

        const { error: headerError } = await this.db
            .from(HEADER_TABLE)
            .update(this.stampUpdate(ctx, { ...header }))
            .eq('id', id)
            .eq('company_id', Number(ctx.companyId));

        if (headerError) throw new ApiError(headerError.message, 500);

        if (items) {
            // Full replace strategy: delete existing lines then re-insert.
            // Serials are (re)created only at POST, so nothing to do here beyond
            // persisting the serial_numbers JSONB carried on each line.
            await this.db.from(LINE_TABLE).delete().eq('receipt_id', id);
            const lineRows = items.map((line) => ({ ...line, receipt_id: id }));
            const { error: lineError } = await this.db
                .from(LINE_TABLE)
                .insert(lineRows);
            if (lineError) throw new ApiError(lineError.message, 500);
        }

        return (await this.findOne(ctx, id))!;
    }

    async postReceipt(
        ctx: RequestContext,
        id: number,
    ): Promise<PostReceiptResult> {
        // ── 1. Load receipt + validate ────────────────────────────────────
        const receipt = await this.findOne(ctx, id);
        if (!receipt)
            throw new NotFoundError(
                `Object not found to post with the given id: ${id}`,
            );
        if (receipt.status !== 'DRAFT')
            throw new BadRequesstExceptionError('receipt cannot be post');
        if (!receipt.items?.length)
            throw new BadRequesstExceptionError(
                'At lease one item are requirement to receipt',
            );

        const companyId = Number(ctx.companyId);

        // ── 2. Record the ledger movement ─────────────────────────────────
        // Convert every line to its base UOM, then hand the whole transaction
        // to the movement engine — it is the ONLY writer of stock balances.
        const itemUomService = ItemUomRepository.getInstance();
        const movementService = MovementRepository.getInstance();

        const movementItems = await Promise.all(
            receipt.items.map(async (item) => {
                const itemMeta = await this.db
                    .from('inventory_item')
                    .select('id, track_serial')
                    .eq('id', item.item_id)
                    .single();
                if (itemMeta.error)
                    throw new ApiError(itemMeta.error.message, 500);

                const enteredUom = item.item_uom_id
                    ? await itemUomService.findOne(ctx, item.item_uom_id)
                    : null;

                if (itemMeta.data?.track_serial) {
                    const serials =
                        (
                            item as ReceiptItemType & {
                                serial_numbers?: string[];
                            }
                        ).serial_numbers ?? [];
                    // One serial is one BASE unit: receiving 10 Box of 12 needs
                    // 120 serials, not 10.
                    const requiredSerials = toBaseQty(
                        Number(item.receipt_qty),
                        uomContextOf(item, enteredUom),
                    );
                    if (serials.length !== requiredSerials) {
                        throw new ApiError(
                            `Serial numbers must match the received quantity (${requiredSerials} required).`,
                            400,
                            'SERIAL_QUANTITY',
                        );
                    }
                }
                const baseUom = await itemUomService.findDefaultByItem(
                    ctx,
                    item.item_id,
                );

                return {
                    item_id: item.item_id,
                    warehouse_id: item.warehouse_id,
                    location_id: item.location_id,
                    entered_qty: Number(item.receipt_qty),
                    // base_qty_received is a stored column that was only ever
                    // correct while conversion_factor was hardcoded to 1. The
                    // conversion service is now the authority.
                    uom: uomContextOf(item, enteredUom),
                    base_uom_id: baseUom?.uom_id ?? null,
                    movement_direction: 'IN' as const,
                    unit_cost: item.unit_cost ?? null,
                    lot_number: item.lot_number ?? null,
                    purchased_date: item.purchased_date ?? null,
                    serial_tracked: Boolean(item.serial_numbers?.length),
                };
            }),
        );

        await movementService.createMovement(ctx, {
            movement_type: 'receipt',
            movement_date: receipt.transaction_date,
            source_module: 'inventory',
            source_document_type: 'receipt',
            source_document_id: receipt.id,
            remarks: receipt.notes,
            items: movementItems,
        });

        // ── 3. Create serial records for serial-tracked lines ─────────────
        // Now that stock exists, materialise one inventory_serial (Available)
        // per entered serial + its initial history row.
        const serialRepo = SerialManagementService.getInstance();
        const trackItemIds = [...new Set(receipt.items.map((i) => i.item_id))];
        const { data: trackRows } = await this.db
            .from('inventory_item')
            .select('id, track_serial')
            .in('id', trackItemIds);
        const trackMap = new Map(
            (trackRows ?? []).map((r) => [r.id, r.track_serial]),
        );
        for (const item of receipt.items) {
            if (!trackMap.get(item.item_id)) continue;
            const serials =
                (item as ReceiptItemType & { serial_numbers?: string[] })
                    .serial_numbers ?? [];
            if (!serials.length) continue;
            await serialRepo.createForReceipt(
                ctx,
                item.item_id,
                item.warehouse_id,
                item.location_id,
                item.id,
                serials,
            );
        }

        // ── 4. Mark receipt as POSTED ─────────────────────────────────────
        const { error: postErr } = await this.db
            .from(HEADER_TABLE)
            .update(this.stampUpdate(ctx, { status: 'POSTED' }))
            .eq('id', id)
            .eq('company_id', companyId);

        if (postErr) throw new ApiError(postErr.message, 500);

        return { ok: true, receipt_id: id };
    }

    async voidReceipt(ctx: RequestContext, id: number): Promise<void> {
        const existing = await this.findOne(ctx, id);
        if (!existing) throw new NotFoundError('Receipt not found');
        if (existing.status === 'VOID') {
            throw new ApiError(
                'Receipt is already voided',
                400,
                'INVALID_STATUS',
            );
        }
        if (existing.status === 'POSTED') {
            throw new ApiError(
                'Posted receipts cannot be voided. Create a reversal receipt instead.',
                400,
                'INVALID_STATUS',
            );
        }

        const { error } = await this.db
            .from(HEADER_TABLE)
            .update(this.stampUpdate(ctx, { status: 'VOID' }))
            .eq('id', id)
            .eq('company_id', Number(ctx.companyId));

        if (error) throw new ApiError(error.message, 500);
    }
}
