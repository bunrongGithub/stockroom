import { BaseRepository } from '@/service/core/base-repository';
import type { QueryConfig } from '@/service/core/query/config.ts';
import type { QueryObject } from '@/service/core/query/types.ts';
import type { PaginatedResult } from '@/service/core/pagination';
import type { RequestContext } from '@/types/request-context';
import { getNextDocumentNumber } from '@/service/core/document-number';
import { ApiError, NotFoundError } from '@/service/core/api-response';
import { StockAdjustmentRepository } from './adjustment';
import { SerialManagementService } from '@/service/apps/inventory/serial';
import {
    buildAdjustmentPlan,
    bucketKey,
    classifyScannedSerials,
    computeCountActions,
    type AdjustmentPlan,
    type CountLineInput,
    type LineSerialSets,
} from './stock-count-logic';
import type {
    CreateStockCountInput,
    UpdateStockCountInput,
    RecordCountsInput,
    SubmitStockCountInput,
} from '@/service/schema/stock-count.schema';
import type {
    ApprovalPreview,
    StockCount,
    StockCountItem,
    StockCountSerial,
    StockCountSummary,
} from '@/types/inventory/stock-count';

const HEADER_TABLE = 'stock_count' as const;
const LINE_TABLE = 'stock_count_items' as const;
const SERIAL_TABLE = 'stock_count_serials' as const;
const LINK_TABLE = 'stock_count_adjustment' as const;
const BALANCE_TABLE = 'inventory_balances' as const;

const SELECT_LIST =
    '*, warehouse:warehouse(id, name), location:warehouse_location(id, name)';
const SELECT_DETAIL =
    SELECT_LIST +
    ', links:stock_count_adjustment(adjustment_id, location_id' +
    ', adjustment:stock_adjustment(id, adjustment_no, status)' +
    ', link_location:warehouse_location(id, name))';

/** Chunk size for full-collection sweeps (lines, balances, serial rows). */
const PAGE = 1000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapStockCount(r: any): StockCount {
    return {
        id: r.id,
        count_no: r.count_no,
        count_date: r.count_date,
        warehouse_id: r.warehouse_id,
        warehouse_name: r.warehouse?.name ?? '',
        location_id: r.location_id ?? null,
        location_name: r.location?.name ?? null,
        count_mode: r.count_mode,
        scope_filter: r.scope_filter ?? {},
        uncounted_policy: r.uncounted_policy,
        status: r.status,
        snapshot_at: r.snapshot_at ?? null,
        counting_started_at: r.counting_started_at ?? null,
        submitted_at: r.submitted_at ?? null,
        approved_at: r.approved_at ?? null,
        completed_at: r.completed_at ?? null,
        cancelled_at: r.cancelled_at ?? null,
        cancel_reason: r.cancel_reason ?? null,
        remarks: r.remarks ?? null,
        created_at: r.created_at,
        updated_at: r.updated_at,
        adjustments: (r.links ?? []).map(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (l: any) => ({
                adjustment_id: l.adjustment_id,
                adjustment_no: l.adjustment?.adjustment_no ?? '',
                status: l.adjustment?.status ?? '',
                location_id: l.location_id,
                location_name: l.link_location?.name ?? '',
            }),
        ),
        actions: computeCountActions(r.status),
    };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapLine(r: any): StockCountItem {
    const isSerial = Boolean(r.is_serial);
    return {
        id: r.id,
        count_id: r.count_id,
        item_id: r.item_id,
        location_id: r.location_id,
        location_name: r.location?.name ?? null,
        item_uom_id: r.item_uom_id ?? null,
        uom: r.item_uom?.name ?? null,
        sku: r.sku ?? null,
        item_name: r.item_name ?? null,
        is_serial: isSerial,
        snapshot_qty: Number(r.snapshot_qty),
        unit_cost: r.unit_cost != null ? Number(r.unit_cost) : null,
        counted_qty: r.counted_qty != null ? Number(r.counted_qty) : null,
        variance_qty: r.variance_qty != null ? Number(r.variance_qty) : null,
        status: r.status,
        counted_at: r.counted_at ?? null,
        remarks: r.remarks ?? null,
        // Serial progress: expected ≈ snapshot (the frozen available serials),
        // scanned = counted (recomputed from scan rows on every change).
        ...(isSerial
            ? {
                  serial_expected: Number(r.snapshot_qty),
                  serial_scanned:
                      r.counted_qty != null ? Number(r.counted_qty) : 0,
              }
            : {}),
    };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapSerial(r: any): StockCountSerial {
    return {
        id: r.id,
        count_item_id: r.count_item_id,
        serial_number: r.serial_number,
        serial_id: r.serial_id ?? null,
        is_expected: r.is_expected,
        is_scanned: r.is_scanned,
        classification: r.classification ?? null,
        scanned_at: r.scanned_at ?? null,
    };
}

// ═════════════════════════════════════════════════════════════════════════════
// Header repository — session lifecycle + approval orchestration
// ═════════════════════════════════════════════════════════════════════════════

export class StockCountRepository extends BaseRepository {
    private static instance: StockCountRepository;

    protected readonly queryConfig: QueryConfig = {
        table: HEADER_TABLE,
        defaultSelect: SELECT_LIST,
        searchable: ['count_no'],
        sortable: ['count_no', 'count_date', 'status', 'created_at'],
        filterable: {
            status: {
                type: 'enum',
                values: [
                    'DRAFT',
                    'PREPARED',
                    'COUNTING',
                    'PENDING_APPROVAL',
                    'APPROVED',
                    'COMPLETED',
                    'CANCELLED',
                ],
            },
            warehouse_id: { type: 'foreign-key' },
            count_date: { type: 'date' },
            created_at: { type: 'date' },
        },
        defaultSort: [{ field: 'id', direction: 'desc' }],
    };

    static getInstance(): StockCountRepository {
        if (!StockCountRepository.instance) {
            StockCountRepository.instance = new StockCountRepository();
        }
        return StockCountRepository.instance;
    }

    async findAllV2(
        ctx: RequestContext,
        query: QueryObject,
    ): Promise<PaginatedResult<StockCount>> {
        return this.findAllQuery<StockCount>(ctx, query, {
            enrichAudit: true,
            map: mapStockCount,
        });
    }

    async findOne(ctx: RequestContext, id: number): Promise<StockCount | null> {
        const { data, error } = await this.applyFilter(
            this.db.from(HEADER_TABLE).select(SELECT_DETAIL).eq('id', id),
            ctx,
            await this.isSupperUser(ctx),
        ).maybeSingle();
        if (error) throw new ApiError(error.message, 500);
        if (!data) return null;
        const mapped = mapStockCount(data);
        return this.enrichAuditOne({
            ...mapped,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            created_by: (data as any).created_by ?? null,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            updated_by: (data as any).updated_by ?? null,
        }) as Promise<StockCount>;
    }

    async create(
        ctx: RequestContext,
        input: CreateStockCountInput,
    ): Promise<StockCount> {
        await this.validateHeader(input);
        const header = await this.auditedInsert<{ id: number }>(
            ctx,
            HEADER_TABLE,
            {
                company_id: Number(ctx.companyId),
                user_id: ctx.userId,
                count_no: await getNextDocumentNumber(ctx, 'stock_count', 'SC'),
                count_date: input.count_date,
                warehouse_id: input.warehouse_id,
                location_id: input.location_id ?? null,
                count_mode: input.count_mode,
                scope_filter: input.scope_filter ?? {},
                remarks: input.remarks ?? null,
                status: 'DRAFT',
            },
        );
        return (await this.findOne(ctx, header.id))!;
    }

    async updateOne(
        ctx: RequestContext,
        id: number,
        input: UpdateStockCountInput,
    ): Promise<StockCount> {
        const existing = await this.assertAction(ctx, id, 'can_update');
        await this.validateHeader(input);
        await this.auditedUpdate(ctx, HEADER_TABLE, existing.id, {
            count_date: input.count_date,
            warehouse_id: input.warehouse_id,
            location_id: input.location_id ?? null,
            count_mode: input.count_mode,
            scope_filter: input.scope_filter ?? {},
            remarks: input.remarks ?? null,
        });
        return (await this.findOne(ctx, id))!;
    }

    async deleteOne(ctx: RequestContext, id: number): Promise<void> {
        await this.assertAction(ctx, id, 'can_delete');
        const { error } = await this.applyFilter(
            this.db.from(HEADER_TABLE).delete().eq('id', id),
            ctx,
            await this.isSupperUser(ctx),
        );
        if (error) throw new ApiError(error.message, 500);
    }

    /**
     * DRAFT → PREPARED. The snapshot freeze runs entirely inside
     * fn_prepare_stock_count (set-based, atomic — safe at 100k lines).
     */
    async prepare(
        ctx: RequestContext,
        id: number,
    ): Promise<{ count: StockCount; line_count: number; serial_count: number }> {
        await this.assertAction(ctx, id, 'can_prepare');
        const { data, error } = await this.db.rpc('fn_prepare_stock_count', {
            p_count_id: id,
        });
        if (error) {
            if (error.message.includes('INVALID_STATUS')) {
                throw new ApiError(
                    'Only DRAFT sessions can be prepared',
                    400,
                    'INVALID_STATUS',
                );
            }
            throw new ApiError(error.message, 500);
        }
        const row = Array.isArray(data) ? data[0] : data;
        const lineCount = Number(row?.line_count ?? 0);
        if (lineCount === 0) {
            // Nothing matched the scope — revert so the scope can be fixed.
            await this.db
                .from(HEADER_TABLE)
                .update({ status: 'DRAFT', snapshot_at: null })
                .eq('id', id);
            throw new ApiError(
                'No stock found in the selected scope — nothing to count',
                400,
                'EMPTY_SCOPE',
            );
        }
        return {
            count: (await this.findOne(ctx, id))!,
            line_count: lineCount,
            serial_count: Number(row?.serial_count ?? 0),
        };
    }

    async startCounting(ctx: RequestContext, id: number): Promise<StockCount> {
        await this.assertAction(ctx, id, 'can_start');
        await this.auditedUpdate(ctx, HEADER_TABLE, id, {
            status: 'COUNTING',
            counting_started_at: new Date().toISOString(),
        });
        return (await this.findOne(ctx, id))!;
    }

    /**
     * Resolve a scanned item barcode/SKU to its count line(s). Multiple lines
     * = the item sits in several locations; the client shows a picker.
     */
    async scanItem(
        ctx: RequestContext,
        countId: number,
        code: string,
    ): Promise<StockCountItem[]> {
        await this.assertAction(ctx, countId, 'can_count');
        const lineRepo = StockCountLineRepository.getInstance();

        const direct = await lineRepo.findBySku(ctx, countId, code);
        if (direct.length > 0) return direct;

        // Fallback: the scanned code may be an item SKU whose snapshot copy
        // differs (renamed since prepare) — resolve the item, match by id.
        const { data: item, error } = await this.db
            .from('inventory_item')
            .select('id')
            .eq('company_id', Number(ctx.companyId))
            .eq('sku', code)
            .maybeSingle();
        if (error) throw new ApiError(error.message, 500);
        if (!item) return [];
        return lineRepo.findByItemId(ctx, countId, item.id);
    }

    async summary(
        ctx: RequestContext,
        id: number,
    ): Promise<StockCountSummary> {
        const count = await this.findOne(ctx, id);
        if (!count) throw new NotFoundError('Stock count not found');
        const { data, error } = await this.db.rpc('fn_stock_count_summary', {
            p_count_id: id,
        });
        if (error) throw new ApiError(error.message, 500);
        const row = (Array.isArray(data) ? data[0] : data) ?? {};
        const total = Number(row.total_lines ?? 0);
        const counted = Number(row.counted_lines ?? 0);
        return {
            total_lines: total,
            counted_lines: counted,
            pending_lines: Number(row.pending_lines ?? 0),
            positive_lines: Number(row.positive_lines ?? 0),
            negative_lines: Number(row.negative_lines ?? 0),
            zero_lines: Number(row.zero_lines ?? 0),
            qty_over: Number(row.qty_over ?? 0),
            qty_short: Number(row.qty_short ?? 0),
            variance_value: Number(row.variance_value ?? 0),
            progress_pct: total > 0 ? Math.round((counted / total) * 100) : 0,
        };
    }

    async submitForApproval(
        ctx: RequestContext,
        id: number,
        input: SubmitStockCountInput,
    ): Promise<StockCount> {
        await this.assertAction(ctx, id, 'can_submit');
        const { count: countedLines, error } = await this.db
            .from(LINE_TABLE)
            .select('id', { count: 'exact', head: true })
            .eq('count_id', id)
            .eq('status', 'COUNTED');
        if (error) throw new ApiError(error.message, 500);
        if (!countedLines) {
            throw new ApiError(
                'Nothing counted yet — count at least one line before submitting',
                400,
                'NOTHING_COUNTED',
            );
        }
        await this.auditedUpdate(ctx, HEADER_TABLE, id, {
            status: 'PENDING_APPROVAL',
            uncounted_policy: input.uncounted_policy,
            submitted_by: ctx.userId,
            submitted_at: new Date().toISOString(),
        });
        return (await this.findOne(ctx, id))!;
    }

    async reopenToCounting(
        ctx: RequestContext,
        id: number,
    ): Promise<StockCount> {
        await this.assertAction(ctx, id, 'can_reopen');
        await this.auditedUpdate(ctx, HEADER_TABLE, id, {
            status: 'COUNTING',
            submitted_by: null,
            submitted_at: null,
        });
        return (await this.findOne(ctx, id))!;
    }

    async cancel(
        ctx: RequestContext,
        id: number,
        reason?: string | null,
    ): Promise<StockCount> {
        await this.assertAction(ctx, id, 'can_cancel');
        await this.auditedUpdate(ctx, HEADER_TABLE, id, {
            status: 'CANCELLED',
            cancelled_by: ctx.userId,
            cancelled_at: new Date().toISOString(),
            cancel_reason: reason ?? null,
        });
        return (await this.findOne(ctx, id))!;
    }

    /** Read-only dry run of the approve algorithm — powers the review UI. */
    async approvalPreview(
        ctx: RequestContext,
        id: number,
    ): Promise<ApprovalPreview> {
        const count = await this.findOne(ctx, id);
        if (!count) throw new NotFoundError('Stock count not found');
        if (count.status !== 'PENDING_APPROVAL') {
            throw new ApiError(
                'Preview is only available while pending approval',
                400,
                'INVALID_STATUS',
            );
        }
        const { plan, doneLocations, locationNames } = await this.buildPlan(
            ctx,
            count,
        );
        return {
            count_id: id,
            uncounted_policy: count.uncounted_policy,
            uncounted_lines: plan.uncounted_lines,
            locations: plan.locations.map((loc) => ({
                location_id: loc.location_id,
                location_name: locationNames.get(loc.location_id) ?? null,
                already_generated: doneLocations.has(loc.location_id),
                lines: loc.lines.map((l) => ({
                    line_id: l.line_id,
                    item_id: l.item_id,
                    sku: l.sku,
                    item_name: l.item_name,
                    is_serial: l.is_serial,
                    snapshot_qty: l.snapshot_qty,
                    counted_qty: l.counted_qty,
                    live_qty: l.live_qty,
                    shown_variance: l.shown_variance,
                    adjustment_qty: l.adjustment_qty,
                    drift: l.drift,
                    serial_numbers: l.serial_numbers,
                })),
            })),
            dropped_serials: plan.dropped_serials,
            foreign_serials: plan.foreign_serials,
            total_adjustment_lines: plan.total_adjustment_lines,
            has_variance: plan.has_variance,
        };
    }

    /**
     * PENDING_APPROVAL → COMPLETED. Generates + posts ONE Stock Adjustment per
     * location with variance (reason STOCK_COUNT) through the existing
     * adjustment service — the movement engine stays the only balance writer.
     *
     * Not atomic across locations by design (posted adjustments are never
     * rolled back). A mid-sequence failure leaves the session PENDING_APPROVAL;
     * re-running approve resumes at the locations without a link row.
     */
    async approve(ctx: RequestContext, id: number): Promise<StockCount> {
        const count = await this.findOne(ctx, id);
        if (!count) throw new NotFoundError('Stock count not found');
        if (count.status !== 'PENDING_APPROVAL') {
            throw new ApiError(
                'Only sessions pending approval can be approved',
                400,
                'INVALID_STATUS',
            );
        }

        const { plan, doneLocations } = await this.buildPlan(ctx, count);
        const adjustmentRepo = StockAdjustmentRepository.getInstance();
        const failures: string[] = [];

        for (const loc of plan.locations) {
            if (doneLocations.has(loc.location_id)) continue;
            let draftId: number | null = null;
            let posted = false;
            try {
                const adjustment = await adjustmentRepo.create(ctx, {
                    reference_no: count.count_no,
                    adjustment_date: new Date().toISOString().slice(0, 10),
                    warehouse_id: count.warehouse_id,
                    location_id: loc.location_id,
                    reason_code: 'STOCK_COUNT',
                    remarks: `Generated from stock count ${count.count_no}`,
                    items: loc.lines.map((l) => ({
                        item_id: l.item_id,
                        // NOT the count line's item_uom_id: that references
                        // inventory_item_uom, but the movement engine's
                        // entered_uom_id FK targets inventory_uom — the ids
                        // don't correspond. Base-UOM quantities need no unit.
                        item_uom_id: null,
                        description: l.item_name ?? undefined,
                        current_qty: l.live_qty,
                        adjustment_qty: l.adjustment_qty,
                        unit_cost: l.unit_cost,
                        serial_numbers: l.serial_numbers,
                        remarks: l.drift
                            ? `Count ${l.counted_qty}; snapshot ${l.snapshot_qty}; live ${l.live_qty} (moved during count)`
                            : null,
                    })),
                });
                draftId = adjustment.id;
                await adjustmentRepo.postAdjustment(ctx, adjustment.id);
                posted = true;
                const { error: linkError } = await this.db
                    .from(LINK_TABLE)
                    .insert({
                        count_id: id,
                        adjustment_id: adjustment.id,
                        location_id: loc.location_id,
                    });
                if (linkError) throw new ApiError(linkError.message, 500);
            } catch (err) {
                // A draft that never posted is an orphan — remove it so a
                // re-run doesn't accumulate DRAFT adjustments. Posted docs are
                // never rolled back; the missing link row is repaired below.
                if (draftId !== null && !posted) {
                    await adjustmentRepo
                        .deleteOne(ctx, draftId)
                        .catch(() => undefined);
                }
                if (draftId !== null && posted) {
                    await this.db
                        .from(LINK_TABLE)
                        .upsert(
                            {
                                count_id: id,
                                adjustment_id: draftId,
                                location_id: loc.location_id,
                            },
                            { onConflict: 'count_id,location_id' },
                        );
                }
                const message =
                    err instanceof Error ? err.message : 'Unknown error';
                failures.push(`location #${loc.location_id}: ${message}`);
                break; // stop at the first failure; the rest resume on re-run
            }
        }

        if (failures.length > 0) {
            throw new ApiError(
                `Adjustment generation failed (${failures.join('; ')}). ` +
                    'Already-generated locations are saved — fix the issue and approve again to resume.',
                500,
                'APPROVAL_PARTIAL',
            );
        }

        await this.auditedUpdate(ctx, HEADER_TABLE, id, {
            status: 'COMPLETED',
            approved_by: ctx.userId,
            approved_at: count.approved_at ?? new Date().toISOString(),
            completed_at: new Date().toISOString(),
        });
        return (await this.findOne(ctx, id))!;
    }

    // ── internals ────────────────────────────────────────────────────────────

    /** Guard: throw unless the session's state machine allows `action`. */
    async assertAction(
        ctx: RequestContext,
        id: number,
        action: keyof ReturnType<typeof computeCountActions>,
    ): Promise<StockCount> {
        const existing = await this.findOne(ctx, id);
        if (!existing) throw new NotFoundError('Stock count not found');
        if (!computeCountActions(existing.status)[action]) {
            throw new ApiError(
                `Action not allowed while the session is ${existing.status}`,
                400,
                'INVALID_STATUS',
            );
        }
        return existing;
    }

    private async validateHeader(
        input: CreateStockCountInput,
    ): Promise<void> {
        if (input.location_id) {
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
        }
    }

    /**
     * Assemble the pure adjustment plan from live DB state: candidate lines
     * (chunked), live balances (chunked), serial reconciliation sets with
     * missing serials re-validated against availability.
     */
    private async buildPlan(
        ctx: RequestContext,
        count: StockCount,
    ): Promise<{
        plan: AdjustmentPlan;
        doneLocations: Set<number>;
        locationNames: Map<number, string>;
    }> {
        const companyId = Number(ctx.companyId);

        // 1. Candidate lines (policy 'zero' also pulls uncounted lines).
        const lines: CountLineInput[] = [];
        for (let from = 0; ; from += PAGE) {
            let q = this.db
                .from(LINE_TABLE)
                .select(
                    'id, item_id, location_id, item_uom_id, is_serial, sku, item_name, snapshot_qty, counted_qty, unit_cost',
                )
                .eq('count_id', count.id)
                .order('id', { ascending: true })
                .range(from, from + PAGE - 1);
            if (count.uncounted_policy === 'ignore') {
                q = q.eq('status', 'COUNTED');
            }
            const { data, error } = await q;
            if (error) throw new ApiError(error.message, 500);
            for (const r of data ?? []) {
                lines.push({
                    line_id: r.id,
                    item_id: r.item_id,
                    location_id: r.location_id,
                    item_uom_id: r.item_uom_id ?? null,
                    is_serial: r.is_serial,
                    snapshot_qty: Number(r.snapshot_qty),
                    counted_qty:
                        r.counted_qty != null ? Number(r.counted_qty) : null,
                    unit_cost: r.unit_cost != null ? Number(r.unit_cost) : null,
                    sku: r.sku,
                    item_name: r.item_name,
                });
            }
            if (!data || data.length < PAGE) break;
        }

        // 2. Live on-hand per bucket for the warehouse (chunked sweep).
        const liveQty = new Map<string, number>();
        for (let from = 0; ; from += PAGE) {
            let q = this.db
                .from(BALANCE_TABLE)
                .select('item_id, location_id, qty_on_hand')
                .eq('company_id', companyId)
                .eq('warehouse_id', count.warehouse_id)
                .order('id', { ascending: true })
                .range(from, from + PAGE - 1);
            if (count.location_id) q = q.eq('location_id', count.location_id);
            const { data, error } = await q;
            if (error) throw new ApiError(error.message, 500);
            for (const r of data ?? []) {
                liveQty.set(
                    bucketKey(r.item_id, r.location_id),
                    Number(r.qty_on_hand),
                );
            }
            if (!data || data.length < PAGE) break;
        }

        // 3. Serial reconciliation sets for the serial lines in the plan.
        const serialLines = lines.filter((l) => l.is_serial);
        const serialSets = new Map<number, LineSerialSets>();
        if (serialLines.length > 0) {
            type SerialRow = {
                count_item_id: number;
                serial_number: string;
                is_expected: boolean;
                is_scanned: boolean;
                classification: string | null;
            };
            const rows: SerialRow[] = [];
            const lineIds = serialLines.map((l) => l.line_id);
            for (let i = 0; i < lineIds.length; i += 200) {
                const chunk = lineIds.slice(i, i + 200);
                for (let from = 0; ; from += PAGE) {
                    const { data, error } = await this.db
                        .from(SERIAL_TABLE)
                        .select(
                            'count_item_id, serial_number, is_expected, is_scanned, classification',
                        )
                        .in('count_item_id', chunk)
                        .order('id', { ascending: true })
                        .range(from, from + PAGE - 1);
                    if (error) throw new ApiError(error.message, 500);
                    rows.push(...((data ?? []) as SerialRow[]));
                    if (!data || data.length < PAGE) break;
                }
            }

            const byLine = new Map<number, SerialRow[]>();
            for (const r of rows) {
                const list = byLine.get(r.count_item_id) ?? [];
                list.push(r);
                byLine.set(r.count_item_id, list);
            }

            const serialRepo = SerialManagementService.getInstance();
            for (const line of serialLines) {
                const lineRows = byLine.get(line.line_id) ?? [];
                const missingCandidates = lineRows
                    .filter((r) => r.is_expected && !r.is_scanned)
                    .map((r) => r.serial_number);
                const added = lineRows
                    .filter((r) => r.classification === 'new' && r.is_scanned)
                    .map((r) => r.serial_number);
                const foreign = lineRows
                    .filter((r) => r.classification === 'foreign')
                    .map((r) => r.serial_number);

                // Re-validate: a "missing" serial consumed since the snapshot
                // (sold/shipped) is no longer available to remove — drop it
                // from the OUT set and surface it as drift instead.
                let missing: string[] = [];
                let dropped: string[] = [];
                if (missingCandidates.length > 0) {
                    const found = await serialRepo.findSelectableForSale(ctx, {
                        itemId: line.item_id,
                        warehouseId: count.warehouse_id,
                        locationId: line.location_id,
                        serialNumbers: missingCandidates,
                    });
                    const stillAvailable = new Set(
                        found.map((f: { serial_number: string }) => f.serial_number),
                    );
                    missing = missingCandidates.filter((s) =>
                        stillAvailable.has(s),
                    );
                    dropped = missingCandidates.filter(
                        (s) => !stillAvailable.has(s),
                    );
                }
                serialSets.set(line.line_id, {
                    missing,
                    dropped,
                    added,
                    foreign,
                });
            }
        }

        const plan = buildAdjustmentPlan(
            lines,
            liveQty,
            serialSets,
            count.uncounted_policy,
        );

        // Under 'ignore' the pending lines never reach the plan (the fetch is
        // filtered to COUNTED), so count them separately for the preview.
        if (count.uncounted_policy === 'ignore') {
            const { count: pending, error: pendingError } = await this.db
                .from(LINE_TABLE)
                .select('id', { count: 'exact', head: true })
                .eq('count_id', count.id)
                .eq('status', 'PENDING');
            if (pendingError) throw new ApiError(pendingError.message, 500);
            plan.uncounted_lines = pending ?? 0;
        }

        // 4. Locations already covered by a generated adjustment (resume).
        const { data: links, error: linkError } = await this.db
            .from(LINK_TABLE)
            .select('location_id')
            .eq('count_id', count.id);
        if (linkError) throw new ApiError(linkError.message, 500);
        const doneLocations = new Set<number>(
            (links ?? []).map((l) => l.location_id),
        );

        // Location names for the preview.
        const locationNames = new Map<number, string>();
        const locIds = plan.locations.map((l) => l.location_id);
        if (locIds.length > 0) {
            const { data: locs, error: locError } = await this.db
                .from('warehouse_location')
                .select('id, name')
                .in('id', locIds);
            if (locError) throw new ApiError(locError.message, 500);
            for (const l of locs ?? []) locationNames.set(l.id, l.name);
        }

        return { plan, doneLocations, locationNames };
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// Line repository — the 100k-scale counting worksheet
// ═════════════════════════════════════════════════════════════════════════════

const LINE_SELECT =
    '*, location:warehouse_location(id, name), item_uom:inventory_item_uom(id, name)';

export class StockCountLineRepository extends BaseRepository {
    private static instance: StockCountLineRepository;

    protected readonly queryConfig: QueryConfig = {
        table: LINE_TABLE,
        defaultSelect: LINE_SELECT,
        searchable: ['sku', 'item_name'],
        sortable: [
            'sku',
            'item_name',
            'snapshot_qty',
            'counted_qty',
            'variance_qty',
            'counted_at',
        ],
        filterable: {
            status: { type: 'enum', values: ['PENDING', 'COUNTED'] },
            location_id: { type: 'foreign-key' },
            is_serial: { type: 'boolean' },
            variance_qty: {
                type: 'number',
                operators: ['eq', 'gt', 'lt', 'gte', 'lte', 'not_null'],
            },
        },
        defaultSort: [{ field: 'id', direction: 'asc' }],
    };

    static getInstance(): StockCountLineRepository {
        if (!StockCountLineRepository.instance) {
            StockCountLineRepository.instance =
                new StockCountLineRepository();
        }
        return StockCountLineRepository.instance;
    }

    /** Paginated worksheet — count_id is server-pinned, never client input. */
    async findLinesV2(
        ctx: RequestContext,
        countId: number,
        query: QueryObject,
    ): Promise<PaginatedResult<StockCountItem>> {
        return this.findAllQuery<StockCountItem>(ctx, query, {
            forced: [
                {
                    column: 'count_id',
                    operator: 'eq',
                    value: countId,
                    type: 'number',
                },
            ],
            map: mapLine,
        });
    }

    async findBySku(
        ctx: RequestContext,
        countId: number,
        sku: string,
    ): Promise<StockCountItem[]> {
        const { data, error } = await this.applyFilter(
            this.db
                .from(LINE_TABLE)
                .select(LINE_SELECT)
                .eq('count_id', countId)
                .ilike('sku', sku),
            ctx,
            await this.isSupperUser(ctx),
        );
        if (error) throw new ApiError(error.message, 500);
        return (data ?? []).map(mapLine);
    }

    async findByItemId(
        ctx: RequestContext,
        countId: number,
        itemId: number,
    ): Promise<StockCountItem[]> {
        const { data, error } = await this.applyFilter(
            this.db
                .from(LINE_TABLE)
                .select(LINE_SELECT)
                .eq('count_id', countId)
                .eq('item_id', itemId),
            ctx,
            await this.isSupperUser(ctx),
        );
        if (error) throw new ApiError(error.message, 500);
        return (data ?? []).map(mapLine);
    }

    /**
     * Batched worksheet saves. Non-serial lines set counted_qty directly;
     * serial lines only accept a value equal to their scanned-serial count
     * (the panel drives the number — this "confirms" it, incl. confirming 0).
     */
    async recordCounts(
        ctx: RequestContext,
        countId: number,
        input: RecordCountsInput,
    ): Promise<StockCountItem[]> {
        await StockCountRepository.getInstance().assertAction(
            ctx,
            countId,
            'can_count',
        );

        const ids = input.entries.map((e) => e.line_id);
        const { data: rows, error } = await this.db
            .from(LINE_TABLE)
            .select('id, is_serial, count_id')
            .eq('count_id', countId)
            .in('id', ids);
        if (error) throw new ApiError(error.message, 500);
        const byId = new Map((rows ?? []).map((r) => [r.id, r]));

        for (const entry of input.entries) {
            if (!byId.has(entry.line_id)) {
                throw new ApiError(
                    `Line #${entry.line_id} does not belong to this count`,
                    400,
                );
            }
        }

        const serialEntries = input.entries.filter(
            (e) => byId.get(e.line_id)?.is_serial,
        );
        if (serialEntries.length > 0) {
            // Serial counted_qty is derived from scans; only allow confirming
            // the current scanned figure (which may legitimately be zero).
            const { data: scanCounts, error: scanError } = await this.db
                .from(SERIAL_TABLE)
                .select('count_item_id')
                .in(
                    'count_item_id',
                    serialEntries.map((e) => e.line_id),
                )
                .eq('is_scanned', true)
                .in('classification', ['matched', 'new']);
            if (scanError) throw new ApiError(scanError.message, 500);
            const scannedByLine = new Map<number, number>();
            for (const r of scanCounts ?? []) {
                scannedByLine.set(
                    r.count_item_id,
                    (scannedByLine.get(r.count_item_id) ?? 0) + 1,
                );
            }
            for (const entry of serialEntries) {
                const scanned = scannedByLine.get(entry.line_id) ?? 0;
                if (
                    entry.counted_qty !== null &&
                    entry.counted_qty !== scanned
                ) {
                    throw new ApiError(
                        `Line #${entry.line_id} is serial-tracked: scan serials instead of typing a quantity (scanned: ${scanned})`,
                        400,
                        'SERIAL_LINE_QTY_LOCKED',
                    );
                }
            }
        }

        const now = new Date().toISOString();
        const updated: StockCountItem[] = [];
        for (let i = 0; i < input.entries.length; i += 25) {
            const chunk = input.entries.slice(i, i + 25);
            const results = await Promise.all(
                chunk.map(async (entry) => {
                    const patch: Record<string, unknown> = {
                        counted_qty: entry.counted_qty,
                        status:
                            entry.counted_qty === null ? 'PENDING' : 'COUNTED',
                        counted_by:
                            entry.counted_qty === null ? null : ctx.userId,
                        counted_at: entry.counted_qty === null ? null : now,
                    };
                    if (entry.remarks !== undefined) {
                        patch.remarks = entry.remarks;
                    }
                    const { data, error: updateError } = await this.db
                        .from(LINE_TABLE)
                        .update(patch)
                        .eq('id', entry.line_id)
                        .eq('count_id', countId)
                        .select(LINE_SELECT)
                        .single();
                    if (updateError) {
                        throw new ApiError(updateError.message, 500);
                    }
                    return mapLine(data);
                }),
            );
            updated.push(...results);
        }
        return updated;
    }

    async listSerials(
        ctx: RequestContext,
        countId: number,
        lineId: number,
    ): Promise<StockCountSerial[]> {
        await this.requireLine(ctx, countId, lineId);
        const { data, error } = await this.db
            .from(SERIAL_TABLE)
            .select('*')
            .eq('count_item_id', lineId)
            .order('is_expected', { ascending: false })
            .order('serial_number', { ascending: true });
        if (error) throw new ApiError(error.message, 500);
        return (data ?? []).map(mapSerial);
    }

    /**
     * Record scanned serials for a serial-tracked line. Classification:
     * expected → matched, unknown → new (adjustment IN candidate), existing
     * elsewhere → foreign (investigation only), other item → rejected.
     */
    async recordSerials(
        ctx: RequestContext,
        countId: number,
        lineId: number,
        serials: string[],
    ): Promise<{
        serials: StockCountSerial[];
        rejected: { serial_number: string; reason: string }[];
        counted_qty: number;
    }> {
        const line = await this.requireLine(ctx, countId, lineId);
        if (!line.is_serial) {
            throw new ApiError(
                'This line is not serial-tracked — enter a quantity instead',
                400,
                'NOT_SERIAL_LINE',
            );
        }
        await StockCountRepository.getInstance().assertAction(
            ctx,
            countId,
            'can_count',
        );

        const { data: expectedRows, error: expError } = await this.db
            .from(SERIAL_TABLE)
            .select('serial_number')
            .eq('count_item_id', lineId)
            .eq('is_expected', true);
        if (expError) throw new ApiError(expError.message, 500);
        const expected = new Set(
            (expectedRows ?? []).map((r) => r.serial_number),
        );

        const unknowns = [...new Set(serials.map((s) => s.trim()))].filter(
            (s) => s && !expected.has(s),
        );
        const existing = new Map<
            string,
            {
                id: number;
                item_id: number;
                warehouse_id: number;
                location_id: number;
                status: string;
            }
        >();
        if (unknowns.length > 0) {
            const { data: found, error: foundError } = await this.db
                .from('inventory_serial')
                .select('id, serial_number, item_id, warehouse_id, location_id, status')
                .eq('company_id', Number(ctx.companyId))
                .in('serial_number', unknowns);
            if (foundError) throw new ApiError(foundError.message, 500);
            for (const r of found ?? []) existing.set(r.serial_number, r);
        }

        const { accepted, rejected } = classifyScannedSerials(
            serials,
            expected,
            existing,
            {
                item_id: line.item_id,
                warehouse_id: 0, // bucket identity is item + classification set
                location_id: line.location_id,
            },
        );

        const now = new Date().toISOString();
        const matched = accepted.filter((s) => s.classification === 'matched');
        const others = accepted.filter((s) => s.classification !== 'matched');

        if (matched.length > 0) {
            const { error: matchError } = await this.db
                .from(SERIAL_TABLE)
                .update({
                    is_scanned: true,
                    classification: 'matched',
                    scanned_by: ctx.userId,
                    scanned_at: now,
                })
                .eq('count_item_id', lineId)
                .in(
                    'serial_number',
                    matched.map((s) => s.serial_number),
                );
            if (matchError) throw new ApiError(matchError.message, 500);
        }
        if (others.length > 0) {
            const { error: upsertError } = await this.db
                .from(SERIAL_TABLE)
                .upsert(
                    others.map((s) => ({
                        count_id: countId,
                        count_item_id: lineId,
                        company_id: Number(ctx.companyId),
                        serial_number: s.serial_number,
                        serial_id: existing.get(s.serial_number)?.id ?? null,
                        is_expected: false,
                        is_scanned: true,
                        classification: s.classification,
                        scanned_by: ctx.userId,
                        scanned_at: now,
                    })),
                    { onConflict: 'count_item_id,serial_number' },
                );
            if (upsertError) throw new ApiError(upsertError.message, 500);
        }

        const countedQty = await this.recomputeSerialCount(ctx, countId, lineId);
        return {
            serials: await this.listSerials(ctx, countId, lineId),
            rejected,
            counted_qty: countedQty,
        };
    }

    async removeSerial(
        ctx: RequestContext,
        countId: number,
        lineId: number,
        serialNumber: string,
    ): Promise<{ serials: StockCountSerial[]; counted_qty: number }> {
        await this.requireLine(ctx, countId, lineId);
        await StockCountRepository.getInstance().assertAction(
            ctx,
            countId,
            'can_count',
        );
        const { data: row, error } = await this.db
            .from(SERIAL_TABLE)
            .select('id, is_expected')
            .eq('count_item_id', lineId)
            .eq('serial_number', serialNumber)
            .maybeSingle();
        if (error) throw new ApiError(error.message, 500);
        if (!row) throw new NotFoundError('Serial not found on this line');

        if (row.is_expected) {
            const { error: unsetError } = await this.db
                .from(SERIAL_TABLE)
                .update({
                    is_scanned: false,
                    classification: null,
                    scanned_by: null,
                    scanned_at: null,
                })
                .eq('id', row.id);
            if (unsetError) throw new ApiError(unsetError.message, 500);
        } else {
            const { error: delError } = await this.db
                .from(SERIAL_TABLE)
                .delete()
                .eq('id', row.id);
            if (delError) throw new ApiError(delError.message, 500);
        }

        const countedQty = await this.recomputeSerialCount(ctx, countId, lineId);
        return {
            serials: await this.listSerials(ctx, countId, lineId),
            counted_qty: countedQty,
        };
    }

    // ── internals ────────────────────────────────────────────────────────────

    private async requireLine(
        ctx: RequestContext,
        countId: number,
        lineId: number,
    ): Promise<StockCountItem> {
        const { data, error } = await this.applyFilter(
            this.db
                .from(LINE_TABLE)
                .select(LINE_SELECT)
                .eq('id', lineId)
                .eq('count_id', countId),
            ctx,
            await this.isSupperUser(ctx),
        ).maybeSingle();
        if (error) throw new ApiError(error.message, 500);
        if (!data) throw new NotFoundError('Count line not found');
        return mapLine(data);
    }

    /** counted_qty for serial lines = scanned matched + new (never foreign). */
    private async recomputeSerialCount(
        ctx: RequestContext,
        countId: number,
        lineId: number,
    ): Promise<number> {
        const { count, error } = await this.db
            .from(SERIAL_TABLE)
            .select('id', { count: 'exact', head: true })
            .eq('count_item_id', lineId)
            .eq('is_scanned', true)
            .in('classification', ['matched', 'new']);
        if (error) throw new ApiError(error.message, 500);
        const scanned = count ?? 0;

        const { error: updateError } = await this.db
            .from(LINE_TABLE)
            .update({
                counted_qty: scanned > 0 ? scanned : null,
                status: scanned > 0 ? 'COUNTED' : 'PENDING',
                counted_by: scanned > 0 ? ctx.userId : null,
                counted_at: scanned > 0 ? new Date().toISOString() : null,
            })
            .eq('id', lineId)
            .eq('count_id', countId);
        if (updateError) throw new ApiError(updateError.message, 500);
        return scanned;
    }
}
