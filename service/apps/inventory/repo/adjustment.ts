import { BaseRepository } from '@/service/core/base-repository';
import type { QueryConfig } from '@/service/core/query/config.ts';
import type { QueryObject } from '@/service/core/query/types.ts';
import type {
    PaginationParams,
    PaginatedResult,
} from '@/service/core/pagination';
import type { RequestContext } from '@/types/request-context';
import { getNextDocumentNumber } from '@/service/core/document-number';
import { ApiError, NotFoundError } from '@/service/core/api-response';
import { behaviorOf } from '@/service/core/item-behavior';
import { MovementRepository } from './movement';
import { SerialManagementService } from '@/service/apps/inventory/serial';
import type {
    CreateStockAdjustmentInput,
    UpdateStockAdjustmentInput,
} from '@/service/schema/adjustment.schema';
import type {
    AdjustmentReason,
    StockAdjustment,
    StockAdjustmentActions,
    StockAdjustmentItem,
    StockAdjustmentStatus,
} from '@/types/inventory/adjustment';

const HEADER_TABLE = 'stock_adjustment' as const;
const LINE_TABLE = 'stock_adjustment_items' as const;
const REASON_TABLE = 'adjustment_reason' as const;
const BALANCE_TABLE = 'inventory_balances' as const;

const SELECT_LIST =
    '*, warehouse:warehouse(id, name), location:warehouse_location(id, name), reason:adjustment_reason!stock_adjustment_reason_code_fkey(code, label)';
const SELECT_DETAIL =
    SELECT_LIST +
    ', items:stock_adjustment_items(*, item:inventory_item(id, name, sku, track_serial, item_class, cost), item_uom:inventory_item_uom(id, name))';

/** Negative-adjustment serial terminal state, by business reason. */
function terminalStatusFor(
    reasonCode: string,
): 'removed' | 'damaged' | 'scrapped' {
    if (reasonCode === 'DAMAGED') return 'damaged';
    if (reasonCode === 'EXPIRED') return 'scrapped';
    return 'removed';
}

/** Draft = editable/deletable/postable; Posted = locked; Void = terminal. */
export function computeAdjustmentActions(
    status: StockAdjustmentStatus,
): StockAdjustmentActions {
    return {
        can_update: status === 'DRAFT',
        can_post: status === 'DRAFT',
        can_void: status === 'DRAFT',
        can_delete: status === 'DRAFT',
    };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapItem(r: any): StockAdjustmentItem {
    return {
        id: r.id,
        item_id: r.item_id,
        item_uom_id: r.item_uom_id ?? null,
        product_name: r.item?.name ?? r.description ?? `#${r.item_id}`,
        sku: r.item?.sku ?? null,
        track_serial: r.item?.track_serial ?? false,
        uom: r.item_uom?.name ?? '',
        description: r.description ?? null,
        current_qty: Number(r.current_qty),
        adjustment_qty: Number(r.adjustment_qty),
        new_qty: Number(r.new_qty),
        unit_cost: r.unit_cost != null ? Number(r.unit_cost) : null,
        serial_numbers: Array.isArray(r.serial_numbers) ? r.serial_numbers : [],
        remarks: r.remarks ?? null,
    };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapAdjustment(r: any): StockAdjustment {
    const items = (r.items ?? []).map(mapItem);
    return {
        id: r.id,
        adjustment_no: r.adjustment_no,
        reference_no: r.reference_no ?? null,
        adjustment_date: r.adjustment_date,
        warehouse_id: r.warehouse_id,
        warehouse_name: r.warehouse?.name ?? '',
        location_id: r.location_id,
        location_name: r.location?.name ?? '',
        reason_code: r.reason_code,
        reason_label: r.reason?.label ?? r.reason_code,
        remarks: r.remarks ?? null,
        status: r.status,
        posted_by: r.posted_by ?? null,
        posted_at: r.posted_at ?? null,
        created_at: r.created_at,
        updated_at: r.updated_at,
        items,
        total_in: items
            .filter((i: StockAdjustmentItem) => i.adjustment_qty > 0)
            .reduce((s: number, i: StockAdjustmentItem) => s + i.adjustment_qty, 0),
        total_out: items
            .filter((i: StockAdjustmentItem) => i.adjustment_qty < 0)
            .reduce(
                (s: number, i: StockAdjustmentItem) =>
                    s + Math.abs(i.adjustment_qty),
                0,
            ),
        actions: computeAdjustmentActions(r.status),
    };
}

export class StockAdjustmentRepository extends BaseRepository {
    private static instance: StockAdjustmentRepository;

    /**
     * Query Framework registry. The list keeps SELECT_DETAIL as its default
     * select (items are needed for the total_in/total_out columns), so no
     * relations map — all filterable fields live on the header row.
     */
    protected readonly queryConfig: QueryConfig = {
        table: HEADER_TABLE,
        defaultSelect: SELECT_DETAIL,
        searchable: ['adjustment_no', 'reference_no'],
        sortable: ['adjustment_no', 'adjustment_date', 'status', 'created_at'],
        filterable: {
            status: { type: 'enum', values: ['DRAFT', 'POSTED', 'VOID'] },
            warehouse_id: { type: 'foreign-key' },
            reason_code: { type: 'text', operators: ['eq', 'in'] },
            adjustment_date: { type: 'date' },
            created_at: { type: 'date' },
        },
        defaultSort: [{ field: 'id', direction: 'desc' }],
    };

    /** Standardized list path (Query Framework). */
    async findAllV2(
        ctx: RequestContext,
        query: QueryObject,
    ): Promise<PaginatedResult<StockAdjustment>> {
        return this.findAllQuery<StockAdjustment>(ctx, query, {
            enrichAudit: true,
            map: mapAdjustment,
        });
    }

    static getInstance(): StockAdjustmentRepository {
        if (!StockAdjustmentRepository.instance) {
            StockAdjustmentRepository.instance =
                new StockAdjustmentRepository();
        }
        return StockAdjustmentRepository.instance;
    }

    async findReasons(): Promise<AdjustmentReason[]> {
        const { data, error } = await this.db
            .from(REASON_TABLE)
            .select('code, label')
            .eq('is_active', true)
            .order('sort_order', { ascending: true });
        if (error) throw new ApiError(error.message, 500);
        return data ?? [];
    }

    async findAll(
        ctx: RequestContext,
        params: PaginationParams,
    ): Promise<PaginatedResult<StockAdjustment>> {
        const isSuperUser = await this.isSupperUser(ctx);
        // The `!fkey` disambiguation hint in SELECT_DETAIL defeats supabase's
        // select-string type parser — treat the query untyped for pagination.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let query: any = this.applyFilter(
            this.db.from(HEADER_TABLE).select(SELECT_DETAIL, { count: 'exact' }),
            ctx,
            isSuperUser,
        ).order('id', { ascending: false });
        // Search matches the system number OR the user reference number.
        if (params.search) {
            query = query.or(
                `adjustment_no.ilike.%${params.search}%,reference_no.ilike.%${params.search}%`,
            );
        }
        const result = await this.paginate<Record<string, unknown>>(query, {
            ...params,
            search: undefined,
            searchColumn: undefined,
        });
        return { ...result, data: result.data.map(mapAdjustment) };
    }

    async findOne(
        ctx: RequestContext,
        id: number,
    ): Promise<StockAdjustment | null> {
        const isSuperUser = await this.isSupperUser(ctx);
        const { data, error } = await this.applyFilter(
            this.db.from(HEADER_TABLE).select(SELECT_DETAIL).eq('id', id),
            ctx,
            isSuperUser,
        ).maybeSingle();
        if (error) throw new ApiError(error.message, 500);
        return data ? mapAdjustment(data) : null;
    }

    async create(
        ctx: RequestContext,
        input: CreateStockAdjustmentInput,
    ): Promise<StockAdjustment> {
        const companyId = Number(ctx.companyId);
        await this.validateDraft(ctx, input);

        const { data: header, error } = await this.db
            .from(HEADER_TABLE)
            .insert({
                company_id: companyId,
                user_id: ctx.userId,
                adjustment_no: await getNextDocumentNumber(
                    ctx,
                    'stock_adjustment',
                    'ADJ',
                ),
                reference_no: input.reference_no ?? null,
                adjustment_date: input.adjustment_date,
                warehouse_id: input.warehouse_id,
                location_id: input.location_id,
                reason_code: input.reason_code,
                remarks: input.remarks ?? null,
                status: 'DRAFT',
            })
            .select()
            .single();
        if (error) throw new ApiError(error.message, 500);

        try {
            await this.insertLines(companyId, header.id, input.items);
        } catch (err) {
            await this.db.from(HEADER_TABLE).delete().eq('id', header.id);
            throw err;
        }
        return (await this.findOne(ctx, header.id))!;
    }

    async updateOne(
        ctx: RequestContext,
        id: number,
        input: UpdateStockAdjustmentInput,
    ): Promise<StockAdjustment> {
        const existing = await this.findOne(ctx, id);
        if (!existing) throw new NotFoundError('Adjustment not found');
        if (existing.status !== 'DRAFT') {
            throw new ApiError(
                'Only DRAFT adjustments can be edited',
                400,
                'INVALID_STATUS',
            );
        }
        await this.validateDraft(ctx, input);

        const { error } = await this.applyFilter(
            this.db
                .from(HEADER_TABLE)
                .update({
                    reference_no: input.reference_no ?? null,
                    adjustment_date: input.adjustment_date,
                    warehouse_id: input.warehouse_id,
                    location_id: input.location_id,
                    reason_code: input.reason_code,
                    remarks: input.remarks ?? null,
                })
                .eq('id', id),
            ctx,
            await this.isSupperUser(ctx),
        );
        if (error) throw new ApiError(error.message, 500);

        // Draft lines have no downstream references — replace wholesale.
        const { error: delError } = await this.db
            .from(LINE_TABLE)
            .delete()
            .eq('adjustment_id', id);
        if (delError) throw new ApiError(delError.message, 500);
        await this.insertLines(Number(ctx.companyId), id, input.items);

        return (await this.findOne(ctx, id))!;
    }

    async deleteOne(ctx: RequestContext, id: number): Promise<void> {
        const existing = await this.findOne(ctx, id);
        if (!existing) throw new NotFoundError('Adjustment not found');
        if (existing.status !== 'DRAFT') {
            throw new ApiError(
                'Only DRAFT adjustments can be deleted',
                400,
                'INVALID_STATUS',
            );
        }
        const { error } = await this.applyFilter(
            this.db.from(HEADER_TABLE).delete().eq('id', id),
            ctx,
            await this.isSupperUser(ctx),
        );
        if (error) throw new ApiError(error.message, 500);
    }

    async voidOne(ctx: RequestContext, id: number): Promise<StockAdjustment> {
        const existing = await this.findOne(ctx, id);
        if (!existing) throw new NotFoundError('Adjustment not found');
        if (existing.status !== 'DRAFT') {
            // Future: cancelling a POSTED adjustment = emit opposite movements
            // + restore serials. Deliberately not implemented yet.
            throw new ApiError(
                'Only DRAFT adjustments can be voided',
                400,
                'INVALID_STATUS',
            );
        }
        const { error } = await this.applyFilter(
            this.db.from(HEADER_TABLE).update({ status: 'VOID' }).eq('id', id),
            ctx,
            await this.isSupperUser(ctx),
        );
        if (error) throw new ApiError(error.message, 500);
        return (await this.findOne(ctx, id))!;
    }

    /**
     * DRAFT → POSTED. All stock effects flow through the movement engine
     * (the only inventory_balances writer) — never manual balance edits.
     */
    async postAdjustment(
        ctx: RequestContext,
        id: number,
    ): Promise<StockAdjustment> {
        const adjustment = await this.findOne(ctx, id);
        if (!adjustment) throw new NotFoundError('Adjustment not found');
        if (adjustment.status !== 'DRAFT') {
            throw new ApiError(
                'Only DRAFT adjustments can be posted',
                400,
                'INVALID_STATUS',
            );
        }
        if (!adjustment.items.length) {
            throw new ApiError('Nothing to post: no items', 400);
        }

        const serialRepo = SerialManagementService.getInstance();
        const terminalStatus = terminalStatusFor(adjustment.reason_code);

        // ── Validate every line against LIVE stock & serial state ──────────
        const outSerialIdsByLine = new Map<number, number[]>();
        for (const line of adjustment.items) {
            const qty = line.adjustment_qty;
            const absQty = Math.abs(qty);

            if (line.track_serial && line.serial_numbers.length !== absQty) {
                throw new ApiError(
                    `${line.product_name}: ${absQty} serial number(s) required, got ${line.serial_numbers.length}`,
                    400,
                    'SERIAL_COUNT_MISMATCH',
                );
            }

            if (qty < 0) {
                const onHand = await this.onHand(
                    ctx,
                    line.item_id,
                    adjustment.warehouse_id,
                    adjustment.location_id,
                );
                if (onHand < absQty) {
                    throw new ApiError(
                        `${line.product_name}: only ${onHand} on hand at ${adjustment.location_name}; cannot remove ${absQty}. Negative inventory is not allowed.`,
                        400,
                        'INSUFFICIENT_STOCK',
                    );
                }
                if (line.track_serial) {
                    const found = await serialRepo.findSelectableForSale(ctx, {
                        itemId: line.item_id,
                        warehouseId: adjustment.warehouse_id,
                        locationId: adjustment.location_id,
                        serialNumbers: line.serial_numbers,
                    });
                    if (found.length !== absQty) {
                        const foundSet = new Set(
                            found.map((f) => f.serial_number),
                        );
                        const missing = line.serial_numbers.filter(
                            (sn) => !foundSet.has(sn),
                        );
                        throw new ApiError(
                            `${line.product_name}: serial(s) not available at this location: ${missing.join(', ')}`,
                            400,
                            'SERIAL_NOT_AVAILABLE',
                        );
                    }
                    outSerialIdsByLine.set(
                        line.id,
                        found.map((f) => f.id),
                    );
                }
            }
        }

        // ── ONE movement transaction for the whole document ─────────────────
        await MovementRepository.getInstance().createMovement(ctx, {
            movement_type: 'adjustment',
            movement_date: adjustment.adjustment_date,
            source_module: 'inventory',
            source_document_type: 'stock_adjustment',
            source_document_id: adjustment.id,
            remarks: `${adjustment.adjustment_no} · ${adjustment.reason_label}`,
            items: adjustment.items.map((line) => ({
                item_id: line.item_id,
                warehouse_id: adjustment.warehouse_id,
                location_id: adjustment.location_id,
                entered_qty: Math.abs(line.adjustment_qty),
                entered_uom_id: line.item_uom_id,
                base_qty: Math.abs(line.adjustment_qty),
                base_uom_id: line.item_uom_id,
                movement_direction:
                    line.adjustment_qty > 0 ? ('IN' as const) : ('OUT' as const),
                unit_cost: line.adjustment_qty > 0 ? line.unit_cost : null,
            })),
        });

        // ── Serial effects (after the ledger, matching the receipt order) ───
        for (const line of adjustment.items) {
            if (!line.track_serial) continue;
            if (line.adjustment_qty > 0) {
                await serialRepo.createForAdjustment(
                    ctx,
                    line.item_id,
                    adjustment.warehouse_id,
                    adjustment.location_id,
                    line.id,
                    line.serial_numbers,
                );
            } else {
                await serialRepo.markRemovedByIds(
                    ctx,
                    outSerialIdsByLine.get(line.id) ?? [],
                    line.id,
                    adjustment.warehouse_id,
                    adjustment.location_id,
                    terminalStatus,
                );
            }
        }

        // ── Lock the document ───────────────────────────────────────────────
        const { error } = await this.applyFilter(
            this.db
                .from(HEADER_TABLE)
                .update({
                    status: 'POSTED',
                    posted_by: ctx.userId,
                    posted_at: new Date().toISOString(),
                })
                .eq('id', id),
            ctx,
            await this.isSupperUser(ctx),
        );
        if (error) throw new ApiError(error.message, 500);

        return (await this.findOne(ctx, id))!;
    }

    // ── internals ────────────────────────────────────────────────────────────

    /**
     * Live on-hand from inventory_balances — the table the movement engine
     * writes. Public: the form's "Current Qty" lookup uses it too.
     */
    async onHand(
        ctx: RequestContext,
        itemId: number,
        warehouseId: number,
        locationId: number,
    ): Promise<number> {
        const { data, error } = await this.db
            .from(BALANCE_TABLE)
            .select('qty_on_hand')
            .eq('company_id', Number(ctx.companyId))
            .eq('item_id', itemId)
            .eq('warehouse_id', warehouseId)
            .eq('location_id', locationId)
            .maybeSingle();
        if (error) throw new ApiError(error.message, 500);
        return Number(data?.qty_on_hand ?? 0);
    }

    /** Draft-time validation (cheap; posting re-validates against live state). */
    private async validateDraft(
        ctx: RequestContext,
        input: CreateStockAdjustmentInput,
    ): Promise<void> {
        // Object-level security: the warehouse must belong to the caller's
        // company. warehouse_location has no company_id, so tenant ownership is
        // established through its warehouse — verify that first. 404 (not 403)
        // so we don't reveal another company's warehouse exists.
        const { data: wh } = await this.db
            .from('warehouse')
            .select('id')
            .eq('id', input.warehouse_id)
            .eq('company_id', Number(ctx.companyId))
            .maybeSingle();
        if (!wh) {
            throw new NotFoundError('Warehouse not found');
        }

        // Location must belong to the chosen (now company-verified) warehouse.
        const { data: loc, error } = await this.db
            .from('warehouse_location')
            .select('id, warehouse_id')
            .eq('id', input.location_id)
            .maybeSingle();
        if (error) throw new ApiError(error.message, 500);
        if (!loc || loc.warehouse_id !== input.warehouse_id) {
            throw new ApiError(
                'Location does not belong to the selected warehouse',
                400,
            );
        }

        // Only stock items can be adjusted; serial counts must match now too
        // so drafts are never saved inconsistent.
        const itemIds = input.items.map((l) => l.item_id);
        const { data: items } = await this.db
            .from('inventory_item')
            .select('id, name, item_class, track_serial')
            .eq('company_id', Number(ctx.companyId))
            .in('id', itemIds);
        const byId = new Map((items ?? []).map((i) => [i.id, i]));

        for (const line of input.items) {
            const item = byId.get(line.item_id);
            if (!item) {
                throw new ApiError(`Item #${line.item_id} not found`, 404);
            }
            if (!behaviorOf(item.item_class).requiresInventory) {
                throw new ApiError(
                    `${item.name} is a non-stock item and cannot be adjusted`,
                    400,
                    'NON_STOCK_ITEM',
                );
            }
            if (
                item.track_serial &&
                (line.serial_numbers ?? []).length !==
                    Math.abs(line.adjustment_qty)
            ) {
                throw new ApiError(
                    `${item.name}: serial count must equal the adjustment quantity (${Math.abs(line.adjustment_qty)})`,
                    400,
                    'SERIAL_COUNT_MISMATCH',
                );
            }
        }
    }

    private async insertLines(
        companyId: number,
        adjustmentId: number,
        lines: CreateStockAdjustmentInput['items'],
    ): Promise<void> {
        const rows = lines.map((l) => ({
            adjustment_id: adjustmentId,
            company_id: companyId,
            item_id: l.item_id,
            item_uom_id: l.item_uom_id ?? null,
            description: l.description ?? null,
            current_qty: l.current_qty,
            adjustment_qty: l.adjustment_qty,
            new_qty: l.current_qty + l.adjustment_qty,
            unit_cost: l.adjustment_qty > 0 ? (l.unit_cost ?? null) : null,
            serial_numbers: l.serial_numbers ?? [],
            remarks: l.remarks ?? null,
        }));
        const { error } = await this.db.from(LINE_TABLE).insert(rows);
        if (error) throw new ApiError(error.message, 500);
    }
}
