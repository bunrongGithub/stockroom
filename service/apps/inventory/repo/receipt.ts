import type {
    CreateReceiptInput,
    CreateReceiptLineInput,
    UpdateReceiptInput,
} from '@/service/schema/receipt.schema';
import type {
    PaginationParams,
    PaginatedResult,
} from '@/service/core/pagination';
import { BaseRepository } from '@/service/core/base-repository';
import type { RequestContext } from '@/types/request-context';
import { generateSequenNumbering } from '@/lib/utils/sequenumbering';
import {
    ApiError,
    BadRequesstExceptionError,
    NotFoundError,
    ValidationError,
} from '@/service/core/api-response';
import { ItemUomRepository } from './item-uom';
import { MovementRepository } from './movement';

// ─── Types ────────────────────────────────────────────────────────────────────
export type InventoryTxnMovementType =
    | 'receipt'
    | 'issue'
    | 'transfer'
    | 'adjustment';

export type InventoryMovemtTypeReasonMeta =
    | 'Goods received from a supplier after a purchase order'
    | 'Customer returned goods back to the warehouse'
    | 'Goods transferred to another warehouse'
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

export type ReceiptTxnType = {
    id: number;
    company_id: number;
    company: { id: number; name: string };
    user_id: string;
    reference_no: string;
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
};

type PostReceiptResult = { ok: boolean; receipt_id?: number; error?: string };

// ─── Constants ────────────────────────────────────────────────────────────────

const HEADER_TABLE = 'receipt_transaction' as const;
const LINE_TABLE = 'receipt_items' as const;
const SELECT_LIST = '*, company(id, name), created_by:profiles(id, full_name)';
const SELECT_DETAIL =
    '*, company(id, name), created_by:profiles(id, full_name), items:receipt_items(*, item:inventory_item(id, name), warehouse:warehouse(id, name), location:warehouse_location(id, name), item_uom:inventory_item_uom(id, name, display_name))';

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
                    conversion_factor: 1,
                    lot_number: item.lot_number ?? null,
                    purchased_date: item.purchased_date ?? null,
                    unit_cost: item.unit_cost ?? null,
                };
            }),
        );

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
        const query = this.applyFilter(
            this.db.from(HEADER_TABLE).select(SELECT_LIST, { count: 'exact' }),
            ctx,
            isSuperUser,
        ).order('id', { ascending: false });
        return this.paginate(query, params);
    }

    async findOne(
        ctx: RequestContext,
        id: number,
    ): Promise<ReceiptTxnType | null> {
        const isSuperUser = await this.isSupperUser(ctx);
        const { data, error } = await this.applyFilter(
            this.db.from(HEADER_TABLE).select(SELECT_DETAIL).eq('id', id),
            ctx,
            isSuperUser,
        ).maybeSingle();

        if (error) throw new ApiError(error.message, 500);
        return data as ReceiptTxnType | null;
    }

    async insertOne(
        ctx: RequestContext,
        input: CreateReceiptInput,
    ): Promise<ReceiptTxnType> {
        const reference_no = generateSequenNumbering('INR');
        const { items, ...header } = input;

        const { data: headerData, error: headerError } = await this.db
            .from(HEADER_TABLE)
            .insert({
                ...header,
                reference_no,
                status: 'DRAFT',
                company_id: Number(ctx.companyId),
                user_id: ctx.userId,
            })
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
            .update({ ...header })
            .eq('id', id)
            .eq('company_id', Number(ctx.companyId));

        if (headerError) throw new ApiError(headerError.message, 500);

        if (items) {
            // Full replace strategy: delete existing lines then re-insert
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
                const enteredUom = item.item_uom_id
                    ? await itemUomService.findOne(ctx, item.item_uom_id)
                    : null;
                const baseUom = await itemUomService.findDefaultByItem(
                    ctx,
                    item.item_id,
                );

                return {
                    item_id: item.item_id,
                    warehouse_id: item.warehouse_id,
                    location_id: item.location_id,
                    entered_qty: Number(item.receipt_qty),
                    entered_uom_id: enteredUom?.uom_id ?? null,
                    base_qty: Number(item.base_qty_received),
                    base_uom_id: baseUom?.uom_id ?? null,
                    movement_direction: 'IN' as const,
                    unit_cost: item.unit_cost ?? null,
                    lot_number: item.lot_number ?? null,
                    purchased_date: item.purchased_date ?? null,
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

        // ── 3. Mark receipt as POSTED ─────────────────────────────────────
        const { error: postErr } = await this.db
            .from(HEADER_TABLE)
            .update({ status: 'POSTED' })
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
            .update({ status: 'VOID' })
            .eq('id', id)
            .eq('company_id', Number(ctx.companyId));

        if (error) throw new ApiError(error.message, 500);
    }
}
