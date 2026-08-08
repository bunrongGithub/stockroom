import { BaseRepository } from '@/service/core/base-repository';
import { ApiError } from '@/service/core/api-response';
import { behaviorOf } from '@/service/core/item-behavior';
import {
    assertWholeBaseQty,
    baseUomContext,
    toBaseQty,
    type UomContext,
} from '@/service/core/uom-conversion';
import { getNextDocumentNumber } from '@/service/core/document-number';
import type { RequestContext } from '@/types/request-context';
import type { InventoryTxnMovementType } from './receipt';

// ─── Types ────────────────────────────────────────────────────────────────────

export type MovementDirection = 'IN' | 'OUT';

export type InventoryMovement = {
    id: number;
    company_id: number;
    created_by: string | null;
    reference_no: string;
    movement_date: string;
    movement_type: InventoryTxnMovementType;
    source_module: string;
    source_document_type: string | null;
    source_document_id: number | null;
    status: 'DRAFT' | 'POSTED' | 'VOID';
    remarks: string | null;
    created_at: string;
    updated_at: string;
};

export type InventoryMovementItem = {
    id: number;
    movement_id: number;
    company_id: number;
    item_id: number;
    warehouse_id: number;
    location_id: number;
    entered_qty: number;
    entered_uom_id: number | null;
    base_qty: number;
    base_uom_id: number | null;
    movement_direction: MovementDirection;
    unit_cost: number | null;
    total_cost: number | null;
    lot_number: string | null;
    purchased_date: string | null;
    created_at: string;
};

/**
 * One stock line to record.
 *
 * The caller supplies the quantity **as entered** plus the UOM context it was
 * captured against; this repository derives `base_qty` through
 * service/core/uom-conversion. Callers cannot pass `base_qty` — that is
 * deliberate. Three modules previously each converted differently (shipment
 * multiplied by the live factor, adjustment did not convert at all, receipt
 * used a factor hardcoded to 1); making the base quantity underivable from
 * outside turns that class of bug into a type error.
 *
 * Omit `uom` entirely for a line already expressed in the item's base UOM.
 */
export type CreateMovementItemInput = {
    item_id: number;
    warehouse_id: number;
    location_id: number;
    entered_qty: number;
    /** Conversion context; defaults to base (factor 1) when absent. */
    uom?: UomContext;
    /** inventory_uom.id of the item's base unit, for the ledger's base_uom_id. */
    base_uom_id?: number | null;
    movement_direction: MovementDirection;
    unit_cost?: number | null;
    lot_number?: string | null;
    purchased_date?: string | null;
    /** Set for serial-tracked items so the base quantity is checked whole. */
    serial_tracked?: boolean;
    /** Item name, used only to make a rejected conversion readable. */
    item_label?: string;
};

/** A movement line with its base quantity resolved — internal to this repo. */
type ResolvedMovementItem = CreateMovementItemInput & {
    base_qty: number;
    entered_uom_id: number | null;
};

/**
 * Resolve every line's base quantity once, at the single point of entry to the
 * ledger. Serial-tracked lines must land on a whole number of base units.
 */
function resolveMovementItems(
    items: CreateMovementItemInput[],
): ResolvedMovementItem[] {
    return items.map((item) => {
        const uom = item.uom ?? baseUomContext(null);
        const base_qty = toBaseQty(item.entered_qty, uom);
        if (item.serial_tracked) {
            assertWholeBaseQty(base_qty, item.item_label ?? 'This item');
        }
        return { ...item, base_qty, entered_uom_id: uom.uomId ?? null };
    });
}

/** A whole inventory transaction to record in the ledger. */
export type CreateMovementInput = {
    movement_type: InventoryTxnMovementType;
    movement_date: string;
    source_module: string;
    source_document_type?: string | null;
    source_document_id?: number | null;
    remarks?: string | null;
    items: CreateMovementItemInput[];
};

/** One ledger row for the item-detail Movement tab (with running balance). */
export type ItemLedgerEntry = {
    id: number;
    movement_date: string;
    reference_no: string;
    movement_type: string;
    warehouse: { id: number; name: string } | null;
    location: { id: number; name: string } | null;
    qty_in: number;
    qty_out: number;
    running_balance: number;
};

/** One source business document for the item-detail Transactions tab. */
export type ItemTransactionEntry = {
    movement_id: number;
    reference_no: string;
    movement_type: string;
    movement_date: string;
    source_module: string;
    source_document_type: string | null;
    source_document_id: number | null;
    status: string;
};

// PostgREST returns to-one embeds as an object, but the generated types often
// widen them to arrays — normalise to a single record.
function firstOf<T>(value: T | T[] | null | undefined): T | null {
    if (Array.isArray(value)) return value[0] ?? null;
    return value ?? null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MOVEMENT_TABLE = 'inventory_movement' as const;
const MOVEMENT_ITEM_TABLE = 'inventory_movement_items' as const;
const BALANCE_TABLE = 'inventory_balances' as const;
const BALANCE_DETAIL_TABLE = 'inventory_balance_details' as const;

// ─── Repository / Ledger engine ─────────────────────────────────────────────
//
// The single writer of stock balances. No other module may touch
// `inventory_balances` directly — they call `createMovement()` instead.

export class MovementRepository extends BaseRepository {
    private static instance: MovementRepository;

    static getInstance(): MovementRepository {
        if (!MovementRepository.instance) {
            MovementRepository.instance = new MovementRepository();
        }
        return MovementRepository.instance;
    }

    /**
     * Record an inventory transaction:
     *   1. insert the movement header
     *   2. insert the movement item rows
     *   3. apply every item to the stock balance (base UOM)
     *
     * On any failure the movement header is rolled back so we never leave a
     * half-applied ledger entry behind.
     */
    async createMovement(
        ctx: RequestContext,
        input: CreateMovementInput,
    ): Promise<InventoryMovement> {
        if (!input.items.length) {
            throw new ApiError('A movement requires at least one item', 400);
        }

        const companyId = Number(ctx.companyId);

        // Guard: this is the single writer of stock balances, so it is also the
        // single place that enforces "non-stock items never touch inventory".
        // Any Goods Receipt / Sales Shipment / Adjustment / Transfer / Issue
        // referencing a non-stock (or service) item is rejected here.
        await this.ensureStockItems(input.items.map((i) => i.item_id));

        // Convert every line to base quantities BEFORE the header is written, so
        // a bad conversion (e.g. a fractional quantity on a serial-tracked item)
        // fails before anything is persisted.
        const resolved = resolveMovementItems(input.items);

        const reference_no = await getNextDocumentNumber(
            ctx,
            'inventory_movement',
            'MOV',
        );

        // 1. header
        const { data: header, error: headerError } = await this.db
            .from(MOVEMENT_TABLE)
            .insert({
                company_id: companyId,
                created_by: ctx.userId,
                reference_no,
                movement_date: input.movement_date,
                movement_type: input.movement_type,
                source_module: input.source_module,
                source_document_type: input.source_document_type ?? null,
                source_document_id: input.source_document_id ?? null,
                status: 'POSTED',
                remarks: input.remarks ?? null,
            })
            .select()
            .single();

        if (headerError) throw new ApiError(headerError.message, 500);

        try {
            // 2. item rows — base_qty is derived here and nowhere else.
            const rows = resolved.map((item) => ({
                movement_id: header.id,
                company_id: companyId,
                item_id: item.item_id,
                warehouse_id: item.warehouse_id,
                location_id: item.location_id,
                entered_qty: item.entered_qty,
                entered_uom_id: item.entered_uom_id,
                base_qty: item.base_qty,
                base_uom_id: item.base_uom_id ?? null,
                movement_direction: item.movement_direction,
                unit_cost: item.unit_cost ?? null,
                lot_number: item.lot_number ?? null,
                purchased_date: item.purchased_date ?? null,
            }));

            const { error: itemError } = await this.db
                .from(MOVEMENT_ITEM_TABLE)
                .insert(rows);

            if (itemError) throw new ApiError(itemError.message, 500);

            // 3. apply each line to the stock balance (always base quantities)
            for (const item of resolved) {
                await this.applyToBalance(companyId, item);
            }
        } catch (err) {
            await this.db.from(MOVEMENT_TABLE).delete().eq('id', header.id);
            throw err;
        }

        return header as InventoryMovement;
    }

    /** The POSTED movement recorded by a business document, if any. */
    async findBySource(
        ctx: RequestContext,
        sourceDocumentType: string,
        sourceDocumentId: number,
    ): Promise<InventoryMovement | null> {
        const { data, error } = await this.db
            .from(MOVEMENT_TABLE)
            .select('*')
            .eq('company_id', Number(ctx.companyId))
            .eq('source_document_type', sourceDocumentType)
            .eq('source_document_id', sourceDocumentId)
            .eq('status', 'POSTED')
            .order('id', { ascending: false })
            .maybeSingle();

        if (error) throw new ApiError(error.message, 500);
        return (data as InventoryMovement) ?? null;
    }

    /**
     * Undo a POSTED movement by recording its mirror image: every line is
     * replayed through `createMovement()` with the direction flipped, so stock
     * balances are still only ever written by the single writer. The original is
     * marked VOID, which makes reversal idempotent (a VOID movement cannot be
     * reversed twice) and keeps both entries in the ledger for audit.
     *
     * This is the compensation primitive behind an unwound Cash Sale, and the
     * foundation a Sales Return will build on.
     */
    async reverseMovement(
        ctx: RequestContext,
        movementId: number,
        options: {
            movement_type?: InventoryTxnMovementType;
            remarks?: string | null;
        } = {},
    ): Promise<InventoryMovement> {
        const companyId = Number(ctx.companyId);

        const { data: original, error: headErr } = await this.db
            .from(MOVEMENT_TABLE)
            .select('*')
            .eq('id', movementId)
            .eq('company_id', companyId)
            .maybeSingle();
        if (headErr) throw new ApiError(headErr.message, 500);
        if (!original) throw new ApiError('Movement not found', 404);
        if (original.status !== 'POSTED') {
            throw new ApiError(
                `Only POSTED movements can be reversed (this one is ${original.status})`,
                400,
                'INVALID_STATUS',
            );
        }

        const { data: lines, error: lineErr } = await this.db
            .from(MOVEMENT_ITEM_TABLE)
            .select('*')
            .eq('movement_id', movementId)
            .eq('company_id', companyId);
        if (lineErr) throw new ApiError(lineErr.message, 500);
        if (!lines?.length) {
            throw new ApiError('Movement has no lines to reverse', 400);
        }

        const reversal = await this.createMovement(ctx, {
            movement_type: options.movement_type ?? original.movement_type,
            movement_date: new Date().toISOString().slice(0, 10),
            source_module: original.source_module,
            source_document_type: original.source_document_type,
            source_document_id: original.source_document_id,
            remarks:
                options.remarks ?? `Reversal of ${original.reference_no}`,
            items: lines.map((l) => ({
                item_id: l.item_id,
                warehouse_id: l.warehouse_id,
                location_id: l.location_id,
                entered_qty: Number(l.entered_qty),
                entered_uom_id: l.entered_uom_id,
                base_qty: Number(l.base_qty),
                base_uom_id: l.base_uom_id,
                movement_direction:
                    l.movement_direction === 'IN'
                        ? ('OUT' as const)
                        : ('IN' as const),
                unit_cost: l.unit_cost,
                lot_number: l.lot_number,
                purchased_date: l.purchased_date,
            })),
        });

        // Only void the original once its mirror has actually landed.
        const { error: voidErr } = await this.db
            .from(MOVEMENT_TABLE)
            .update({ status: 'VOID' })
            .eq('id', movementId)
            .eq('company_id', companyId);
        if (voidErr) throw new ApiError(voidErr.message, 500);

        return reversal;
    }

    /**
     * Full stock ledger for one item, oldest → newest, with a running balance.
     * Rows are returned newest-first for display.
     */
    async findItemLedger(
        ctx: RequestContext,
        itemId: number,
    ): Promise<ItemLedgerEntry[]> {
        const { data, error } = await this.db
            .from(MOVEMENT_ITEM_TABLE)
            .select(
                `id, base_qty, movement_direction,
                warehouse:warehouse(id, name),
                location:warehouse_location(id, name),
                movement:inventory_movement!inner(id, reference_no, movement_type, movement_date, status)`,
            )
            .eq('company_id', Number(ctx.companyId))
            .eq('item_id', itemId)
            // id ascending ≈ chronological insertion order (movements are
            // written in transaction order) — required for a running balance.
            .order('id', { ascending: true });

        if (error) throw new ApiError(error.message, 500);

        let running = 0;
        const ascending = (data ?? []).map((row) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const r = row as any;
            const mv = firstOf(r.movement);
            const qty = Number(r.base_qty);
            const isIn = r.movement_direction === 'IN';
            running += isIn ? qty : -qty;

            return {
                id: r.id,
                movement_date: mv?.movement_date ?? '',
                reference_no: mv?.reference_no ?? '',
                movement_type: mv?.movement_type ?? '',
                warehouse: firstOf(r.warehouse),
                location: firstOf(r.location),
                qty_in: isIn ? qty : 0,
                qty_out: isIn ? 0 : qty,
                running_balance: running,
            } as ItemLedgerEntry;
        });

        return ascending.reverse();
    }

    /** Distinct source documents that moved this item (Transactions tab). */
    async findItemTransactions(
        ctx: RequestContext,
        itemId: number,
    ): Promise<ItemTransactionEntry[]> {
        const { data, error } = await this.db
            .from(MOVEMENT_ITEM_TABLE)
            .select(
                `movement:inventory_movement!inner(id, reference_no, movement_type, movement_date, source_module, source_document_type, source_document_id, status)`,
            )
            .eq('company_id', Number(ctx.companyId))
            .eq('item_id', itemId)
            .order('id', { ascending: false });

        if (error) throw new ApiError(error.message, 500);

        const seen = new Set<number>();
        const out: ItemTransactionEntry[] = [];
        for (const row of data ?? []) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const mv = firstOf((row as any).movement);
            if (!mv || seen.has(mv.id)) continue;
            seen.add(mv.id);
            out.push({
                movement_id: mv.id,
                reference_no: mv.reference_no,
                movement_type: mv.movement_type,
                movement_date: mv.movement_date,
                source_module: mv.source_module,
                source_document_type: mv.source_document_type ?? null,
                source_document_id: mv.source_document_id ?? null,
                status: mv.status,
            });
        }
        return out;
    }

    /**
     * Reject any movement that references an item whose class does not
     * generate inventory movements (behaviorOf is the source of truth). Kept
     * as defense-in-depth even though callers pre-filter lines by behavior.
     */
    private async ensureStockItems(itemIds: number[]): Promise<void> {
        const uniqueIds = [...new Set(itemIds)];
        if (uniqueIds.length === 0) return;

        const { data, error } = await this.db
            .from('inventory_item')
            .select('id, item_class')
            .in('id', uniqueIds);

        if (error) throw new ApiError(error.message, 500);

        const offending = (data ?? []).find(
            (row) =>
                !behaviorOf((row as { item_class: string }).item_class)
                    .generatesMovement,
        );
        if (offending) {
            throw new ApiError(
                'Non-stock items cannot be used in inventory transactions',
                422,
                'NON_STOCK_NOT_ALLOWED',
            );
        }
    }

    /**
     * Update the summary balance bucket (and, for IN moves, the FIFO aging
     * layer) for a single movement line. Quantity is always in base UOM.
     */
    private async applyToBalance(
        companyId: number,
        item: ResolvedMovementItem,
    ): Promise<void> {
        const signedQty =
            item.movement_direction === 'IN' ? item.base_qty : -item.base_qty;

        // Step A: upsert the summary bucket
        const { data: existingBal } = await this.db
            .from(BALANCE_TABLE)
            .select('id, qty_on_hand')
            .eq('company_id', companyId)
            .eq('item_id', item.item_id)
            .eq('warehouse_id', item.warehouse_id)
            .eq('location_id', item.location_id)
            .maybeSingle();

        let balanceId: number;

        if (existingBal) {
            const nextQty = Number(existingBal.qty_on_hand) + signedQty;
            if (nextQty < 0) {
                throw new ApiError(
                    'Insufficient stock on hand for this movement',
                    422,
                    'INSUFFICIENT_STOCK',
                );
            }
            const { error } = await this.db
                .from(BALANCE_TABLE)
                .update({ qty_on_hand: nextQty })
                .eq('id', existingBal.id);

            if (error) throw new ApiError(error.message, 500);
            balanceId = existingBal.id;
        } else {
            if (signedQty < 0) {
                throw new ApiError(
                    'Insufficient stock on hand for this movement',
                    422,
                    'INSUFFICIENT_STOCK',
                );
            }
            const { data: newBal, error } = await this.db
                .from(BALANCE_TABLE)
                .insert({
                    company_id: companyId,
                    item_id: item.item_id,
                    warehouse_id: item.warehouse_id,
                    location_id: item.location_id,
                    qty_on_hand: signedQty,
                    qty_reserved: 0,
                })
                .select('id')
                .single();

            if (error) throw new ApiError(error.message, 500);
            balanceId = newBal.id;
        }

        // Step B: FIFO aging layer — only tracked for stock coming IN.
        // (Consumption/costing for OUT movements is handled by future work.)
        if (item.movement_direction !== 'IN') return;

        // .is() is required for null lot/date — .eq(col, null) does NOT match SQL NULL
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let detailQ: any = this.db
            .from(BALANCE_DETAIL_TABLE)
            .select('id, qty_on_hand')
            .eq('balance_id', balanceId);

        detailQ = item.lot_number
            ? detailQ.eq('lot_number', item.lot_number)
            : detailQ.is('lot_number', null);

        detailQ = item.purchased_date
            ? detailQ.eq('purchased_date', item.purchased_date)
            : detailQ.is('purchased_date', null);

        const { data: existingDetail } = await detailQ.maybeSingle();

        if (existingDetail) {
            const { error } = await this.db
                .from(BALANCE_DETAIL_TABLE)
                .update({
                    qty_on_hand:
                        Number(existingDetail.qty_on_hand) + item.base_qty,
                })
                .eq('id', existingDetail.id);

            if (error) throw new ApiError(error.message, 500);
        } else {
            const { error } = await this.db
                .from(BALANCE_DETAIL_TABLE)
                .insert({
                    balance_id: balanceId,
                    lot_number: item.lot_number ?? null,
                    purchased_date: item.purchased_date ?? null,
                    qty_on_hand: item.base_qty,
                });

            if (error) throw new ApiError(error.message, 500);
        }
    }
}
