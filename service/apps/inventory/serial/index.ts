import { ApiError } from '@/service/core/api-response';
import { BaseRepository } from '@/service/core/base-repository';
import { InventorySerialRepository } from '@/service/apps/inventory/repo/serial';
import type { RequestContext } from '@/types/request-context';
import { SerialConfigRepository } from './config';
import type { UpdateSerialConfigInput } from './config';
import {
    assertTransition,
    isSerialStatus,
    type SerialStatus,
} from './lifecycle';
import {
    needsSequence,
    renderSerials,
    sequenceScopeKey,
    type SerialGenerationConfig,
} from './strategies';

export type GenerateSerialsInput = {
    itemId: number;
    warehouseId?: number;
    count: number;
};

export type ValidateSerialsInput = {
    itemId: number;
    serials: string[];
    /** 'new' = serials being created (receipt / adjustment in);
     *  'allocate' = existing serials being consumed (shipment / adjustment out). */
    mode: 'new' | 'allocate';
    warehouseId?: number;
    locationId?: number;
};

export type SerialVerdict = {
    serial: string;
    ok: boolean;
    reason?:
        | 'empty'
        | 'duplicate_in_batch'
        | 'already_exists'
        | 'not_found'
        | 'wrong_item'
        | 'wrong_warehouse'
        | 'wrong_location'
        | 'not_available';
};

export type SerialSearchQuery = {
    q?: string;
    status?: SerialStatus;
    itemId?: number;
    warehouseId?: number;
    locationId?: number;
    page?: number;
    limit?: number;
};

const MAX_GENERATE = 1000;
const GENERATE_RETRIES = 5;

/**
 * SerialManagementService — the ERP's single serial engine. Generation,
 * validation, search and reservation live here; the proven transactional
 * flips (sell / return / remove, guarded against races) are delegated to
 * InventorySerialRepository, re-exposed here so every module — Receipt,
 * Shipment, Adjustment, and future Transfer/RMA/Warranty — depends on ONE
 * facade and never re-implements serial logic.
 */
export class SerialManagementService extends BaseRepository {
    private static instance: SerialManagementService;
    private readonly serials = InventorySerialRepository.getInstance();
    private readonly config = SerialConfigRepository.getInstance();

    static getInstance(): SerialManagementService {
        if (!SerialManagementService.instance) {
            SerialManagementService.instance = new SerialManagementService();
        }
        return SerialManagementService.instance;
    }

    // ── Configuration ───────────────────────────────────────────────────────

    getConfig(ctx: RequestContext) {
        return this.config.get(ctx);
    }

    updateConfig(ctx: RequestContext, input: UpdateSerialConfigInput) {
        return this.config.update(ctx, input);
    }

    // ── Generation ──────────────────────────────────────────────────────────

    /**
     * Generate `count` serial numbers for an item. Returns strings only — no
     * rows are written; serials materialize (as `available`) when the receipt
     * or adjustment is POSTED, exactly like manual entry. The sequence block
     * is reserved atomically, so concurrent generators never overlap; a burnt
     * block from an abandoned form only costs unused numbers.
     */
    async generate(
        ctx: RequestContext,
        input: GenerateSerialsInput,
    ): Promise<{ serials: string[]; strategy: string }> {
        if (input.count < 1 || input.count > MAX_GENERATE) {
            throw new ApiError(
                `Count must be between 1 and ${MAX_GENERATE}.`,
                400,
                'SERIAL_GENERATE_ERROR',
            );
        }

        const companyId = Number(ctx.companyId);
        const [cfg, item] = await Promise.all([
            this.config.get(ctx),
            this.loadItem(ctx, input.itemId),
        ]);

        if (!item.track_serial) {
            throw new ApiError(
                'This item does not track serial numbers.',
                400,
                'SERIAL_GENERATE_ERROR',
            );
        }
        if (item.serial_generation === 'manual') {
            throw new ApiError(
                'This item is configured for manual serial entry only.',
                400,
                'SERIAL_GENERATE_ERROR',
            );
        }

        const renderCtx = {
            itemCode: item.sku ?? item.name,
            warehouseCode: input.warehouseId
                ? await this.loadWarehouseCode(ctx, input.warehouseId)
                : undefined,
            companyCode: await this.loadCompanyCode(ctx),
        };

        // Generate, then swap out any serial that already exists (manual
        // entries may occupy numbers). Each retry reserves a fresh block.
        let serials: string[] = [];
        let remaining = input.count;
        for (let attempt = 0; attempt < GENERATE_RETRIES && remaining > 0; attempt++) {
            const blockStart = needsSequence(cfg)
                ? await this.reserveBlock(companyId, cfg, input, remaining)
                : 1;
            const batch = renderSerials(cfg, remaining, blockStart, renderCtx);
            const fresh = await this.filterNonExisting(companyId, batch);
            serials = [...serials, ...fresh].slice(0, input.count);
            remaining = input.count - serials.length;
        }

        if (remaining > 0) {
            throw new ApiError(
                'Could not generate enough unique serials — adjust the numbering configuration.',
                409,
                'SERIAL_GENERATE_ERROR',
            );
        }

        return { serials, strategy: cfg.strategy };
    }

    private async reserveBlock(
        companyId: number,
        cfg: SerialGenerationConfig,
        input: GenerateSerialsInput,
        count: number,
    ): Promise<number> {
        const { data, error } = await this.db.rpc('next_serial_block', {
            p_company_id: companyId,
            p_scope_key: sequenceScopeKey(cfg, {
                itemId: input.itemId,
                warehouseId: input.warehouseId,
            }),
            p_count: count,
            p_start: cfg.start_number,
        });
        if (error)
            throw new ApiError(error.message, 500, 'SERIAL_SEQUENCE_ERROR');
        return Number(data);
    }

    private async filterNonExisting(
        companyId: number,
        serials: string[],
    ): Promise<string[]> {
        const { data, error } = await this.db
            .from('inventory_serial')
            .select('serial_number')
            .eq('company_id', companyId)
            .in('serial_number', serials);
        if (error) throw new ApiError(error.message, 500, 'SERIAL_ERROR');
        const taken = new Set((data ?? []).map((r) => r.serial_number));
        return serials.filter((s) => !taken.has(s));
    }

    // ── Validation ──────────────────────────────────────────────────────────

    /** Per-serial verdicts for a batch, before posting. Never throws on bad
     *  serials — the caller renders the reasons; posting stays the final gate. */
    async validate(
        ctx: RequestContext,
        input: ValidateSerialsInput,
    ): Promise<{ verdicts: SerialVerdict[]; valid: boolean }> {
        const companyId = Number(ctx.companyId);
        const verdicts: SerialVerdict[] = [];
        const seen = new Set<string>();
        const toCheck: string[] = [];

        for (const raw of input.serials) {
            const serial = raw.trim();
            if (!serial) {
                verdicts.push({ serial: raw, ok: false, reason: 'empty' });
                continue;
            }
            const key = serial.toUpperCase();
            if (seen.has(key)) {
                verdicts.push({ serial, ok: false, reason: 'duplicate_in_batch' });
                continue;
            }
            seen.add(key);
            toCheck.push(serial);
            verdicts.push({ serial, ok: true });
        }

        if (toCheck.length) {
            const { data, error } = await this.db
                .from('inventory_serial')
                .select('serial_number, item_id, warehouse_id, location_id, status')
                .eq('company_id', companyId)
                .in('serial_number', toCheck);
            if (error) throw new ApiError(error.message, 500, 'SERIAL_ERROR');

            const rows = new Map(
                (data ?? []).map((r) => [r.serial_number.toUpperCase(), r]),
            );

            for (const v of verdicts) {
                if (!v.ok) continue;
                const row = rows.get(v.serial.toUpperCase());
                if (input.mode === 'new') {
                    if (row) {
                        v.ok = false;
                        v.reason = 'already_exists';
                    }
                    continue;
                }
                // allocate mode — must exist and match item/warehouse/location/status
                if (!row) {
                    v.ok = false;
                    v.reason = 'not_found';
                } else if (row.item_id !== input.itemId) {
                    v.ok = false;
                    v.reason = 'wrong_item';
                } else if (
                    input.warehouseId &&
                    row.warehouse_id !== input.warehouseId
                ) {
                    v.ok = false;
                    v.reason = 'wrong_warehouse';
                } else if (
                    input.locationId &&
                    row.location_id !== input.locationId
                ) {
                    v.ok = false;
                    v.reason = 'wrong_location';
                } else if (row.status !== 'available') {
                    v.ok = false;
                    v.reason = 'not_available';
                }
            }
        }

        return { verdicts, valid: verdicts.every((v) => v.ok) };
    }

    // ── Search ──────────────────────────────────────────────────────────────

    /** Paginated cross-status search — the browser never receives more than
     *  one page. Backed by the (company, serial text_pattern_ops) index. */
    async search(ctx: RequestContext, query: SerialSearchQuery) {
        const page = Math.max(query.page ?? 1, 1);
        const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
        const fromIdx = (page - 1) * limit;

        let q = this.db
            .from('inventory_serial')
            .select(
                `id, serial_number, status, item_id, warehouse_id, location_id, created_at, updated_at,
                 item:inventory_item(id, name, sku),
                 warehouse:warehouse(id, name),
                 location:warehouse_location(id, name)`,
                { count: 'exact' },
            )
            .eq('company_id', Number(ctx.companyId));

        if (query.status && isSerialStatus(query.status))
            q = q.eq('status', query.status);
        if (query.itemId) q = q.eq('item_id', query.itemId);
        if (query.warehouseId) q = q.eq('warehouse_id', query.warehouseId);
        if (query.locationId) q = q.eq('location_id', query.locationId);
        const term = query.q?.trim();
        if (term) q = q.ilike('serial_number', `${term}%`);

        const { data, error, count } = await q
            .order('id', { ascending: false })
            .range(fromIdx, fromIdx + limit - 1);
        if (error) throw new ApiError(error.message, 500, 'SERIAL_ERROR');

        const first = <T>(v: T | T[] | null | undefined): T | null =>
            Array.isArray(v) ? (v[0] ?? null) : (v ?? null);

        return {
            rows: (data ?? []).map((r) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const row = r as any;
                return {
                    id: row.id as number,
                    serial_number: row.serial_number as string,
                    status: row.status as SerialStatus,
                    item_name: first(row.item)?.name ?? '—',
                    item_sku: first(row.item)?.sku ?? null,
                    warehouse_name: first(row.warehouse)?.name ?? '—',
                    location_name: first(row.location)?.name ?? '—',
                    created_at: row.created_at as string,
                    updated_at: row.updated_at as string,
                };
            }),
            meta: { page, limit, total: count ?? 0 },
        };
    }

    // ── Reservation (available ⇄ reserved) ──────────────────────────────────

    reserveByIds(
        ctx: RequestContext,
        serialIds: number[],
        transactionType: string,
        transactionId: number | null,
    ) {
        return this.transitionByIds(ctx, serialIds, 'available', 'reserved', {
            transactionType,
            transactionId,
        });
    }

    releaseByIds(
        ctx: RequestContext,
        serialIds: number[],
        transactionType: string,
        transactionId: number | null,
    ) {
        return this.transitionByIds(ctx, serialIds, 'reserved', 'available', {
            transactionType,
            transactionId,
        });
    }

    /** Generic guarded lifecycle transition + history append. The WHERE on the
     *  current status makes it race-safe: fewer flipped rows than requested
     *  means another transaction won — the whole call rejects with 409. */
    private async transitionByIds(
        ctx: RequestContext,
        serialIds: number[],
        from: SerialStatus,
        to: SerialStatus,
        meta: { transactionType: string; transactionId: number | null },
    ): Promise<void> {
        if (!serialIds.length) return;
        assertTransition(from, to);

        const { data, error } = await this.db
            .from('inventory_serial')
            .update({ status: to })
            .in('id', serialIds)
            .eq('company_id', Number(ctx.companyId))
            .eq('status', from)
            .select('id, warehouse_id, location_id');
        if (error) throw new ApiError(error.message, 400, 'SERIAL_ERROR');

        if ((data?.length ?? 0) !== serialIds.length) {
            throw new ApiError(
                `One or more serials are no longer '${from}'.`,
                409,
                'SERIAL_TRANSITION_CONFLICT',
            );
        }

        const { error: histErr } = await this.db
            .from('inventory_serial_history')
            .insert(
                (data ?? []).map((row) => ({
                    serial_id: row.id,
                    transaction_type: meta.transactionType,
                    transaction_id: meta.transactionId,
                    warehouse_id: row.warehouse_id,
                    location_id: row.location_id,
                    status: to,
                })),
            );
        if (histErr)
            throw new ApiError(histErr.message, 500, 'SERIAL_HISTORY_ERROR');
    }

    // ── Delegated transactional operations (single engine, one import) ──────

    /** Receipt posting: create `available` serials. */
    createForReceipt = this.serials.createForReceipt.bind(this.serials);
    /** Positive adjustment posting: create `available` serials. */
    createForAdjustment = this.serials.createForAdjustment.bind(this.serials);
    /** Shipment posting: allocate (available → sold), race-guarded. */
    markSoldByIds = this.serials.markSoldByIds.bind(this.serials);
    /** Reversal/return: sold → available. */
    markReturnedByIds = this.serials.markReturnedByIds.bind(this.serials);
    /** Negative adjustment: available → removed/damaged/scrapped. */
    markRemovedByIds = this.serials.markRemovedByIds.bind(this.serials);
    /** Available-slice picker (FIFO, server-limited). */
    findAvailable = this.serials.findAvailable.bind(this.serials);
    /** Sellability check for a serial set. */
    findSelectableForSale = this.serials.findSelectableForSale.bind(this.serials);
    /** Full movement history of one serial. */
    findHistory = this.serials.findHistory.bind(this.serials);
    /** Item-detail serial tab (resolved names + document refs). */
    findByItem = this.serials.findByItem.bind(this.serials);
    /** Sold serials for shipment lines (reversal support). */
    findSoldBySaleItemIds = this.serials.findSoldBySaleItemIds.bind(this.serials);

    // ── Entity code lookups (for prefix strategies) ─────────────────────────

    private async loadItem(ctx: RequestContext, itemId: number) {
        const { data, error } = await this.db
            .from('inventory_item')
            .select('id, name, sku, track_serial, serial_generation')
            .eq('id', itemId)
            .eq('company_id', Number(ctx.companyId))
            .maybeSingle();
        if (error) throw new ApiError(error.message, 500, 'SERIAL_ERROR');
        if (!data) throw new ApiError('Item not found.', 404, 'ITEM_NOT_FOUND');
        return data as {
            id: number;
            name: string;
            sku: string | null;
            track_serial: boolean;
            serial_generation: 'manual' | 'auto' | 'both';
        };
    }

    private async loadWarehouseCode(
        ctx: RequestContext,
        warehouseId: number,
    ): Promise<string | undefined> {
        const { data } = await this.db
            .from('warehouse')
            .select('code, name')
            .eq('id', warehouseId)
            .eq('company_id', Number(ctx.companyId))
            .maybeSingle();
        return data?.code ?? data?.name ?? undefined;
    }

    private async loadCompanyCode(
        ctx: RequestContext,
    ): Promise<string | undefined> {
        const { data } = await this.db
            .from('company')
            .select('name')
            .eq('id', Number(ctx.companyId))
            .maybeSingle();
        return data?.name ?? undefined;
    }
}
