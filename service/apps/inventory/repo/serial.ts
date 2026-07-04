import { ApiError } from '@/service/core/api-response';
import { BaseRepository } from '@/service/core/base-repository';
import type { RequestContext } from '@/types/request-context';

export type InventorySerialStatus =
    | 'available'
    | 'reserved'
    | 'sold'
    | 'returned'
    | 'damaged'
    | 'scrapped';

const SERIAL_TABLE = 'inventory_serial' as const;
const HISTORY_TABLE = 'inventory_serial_history' as const;

type HistoryEntry = {
    serial_id: number;
    transaction_type: string;
    transaction_id: number | null;
    warehouse_id: number | null;
    location_id: number | null;
    status: InventorySerialStatus;
};

export class InventorySerialRepository extends BaseRepository {
    private static instance: InventorySerialRepository;

    static getInstance(): InventorySerialRepository {
        if (!InventorySerialRepository.instance) {
            InventorySerialRepository.instance =
                new InventorySerialRepository();
        }
        return InventorySerialRepository.instance;
    }

    /** Append-only audit rows. Never updated or deleted. */
    private async appendHistory(entries: HistoryEntry[]): Promise<void> {
        if (!entries.length) return;
        const { error } = await this.db.from(HISTORY_TABLE).insert(entries);
        if (error)
            throw new ApiError(error.message, 500, 'SERIAL_HISTORY_ERROR');
    }

    /**
     * Create `available` serials for a posted receipt line and record their
     * initial history. Called at POST time (once stock actually exists).
     */
    async createForReceipt(
        ctx: RequestContext,
        itemId: number,
        warehouseId: number,
        locationId: number,
        receiptItemId: number,
        serialNumbers: string[],
    ): Promise<void> {
        const uniqueSerials = [
            ...new Set(serialNumbers.map((s) => s.trim()).filter(Boolean)),
        ];
        if (!uniqueSerials.length) return;
        if (uniqueSerials.length !== serialNumbers.length) {
            throw new ApiError(
                'Duplicate serial numbers are not allowed.',
                400,
                'DUPLICATE_SERIAL',
            );
        }

        const companyId = Number(ctx.companyId);
        const rows = uniqueSerials.map((serial_number) => ({
            company_id: companyId,
            item_id: itemId,
            serial_number,
            warehouse_id: warehouseId,
            location_id: locationId,
            status: 'available',
            receipt_item_id: receiptItemId,
        }));

        const { data, error } = await this.db
            .from(SERIAL_TABLE)
            .insert(rows)
            .select('id');

        if (error) {
            // 23505 = unique_violation on (company_id, serial_number)
            if (error.code === '23505') {
                throw new ApiError(
                    'One or more serial numbers already exist.',
                    409,
                    'SERIAL_EXISTS',
                );
            }
            throw new ApiError(error.message, 400, 'SERIAL_ERROR');
        }

        await this.appendHistory(
            (data ?? []).map((row) => ({
                serial_id: row.id,
                transaction_type: 'receipt',
                transaction_id: receiptItemId,
                warehouse_id: warehouseId,
                location_id: locationId,
                status: 'available',
            })),
        );
    }

    /**
     * Serials that are actually sellable for a given item/warehouse/location.
     * Enforces existence + warehouse (§11) + location (§12) + availability in
     * one query. Callers compare the returned count against the request.
     */
    async findSelectableForSale(
        ctx: RequestContext,
        params: {
            itemId: number;
            warehouseId: number;
            locationId: number;
            serialNumbers: string[];
        },
    ): Promise<{ id: number; serial_number: string }[]> {
        const serials = [...new Set(params.serialNumbers.map((s) => s.trim()))];
        if (!serials.length) return [];

        const { data, error } = await this.db
            .from(SERIAL_TABLE)
            .select('id, serial_number')
            .eq('company_id', Number(ctx.companyId))
            .eq('item_id', params.itemId)
            .eq('warehouse_id', params.warehouseId)
            .eq('location_id', params.locationId)
            .eq('status', 'available')
            .in('serial_number', serials);

        if (error) throw new ApiError(error.message, 500, 'SERIAL_ERROR');
        return data ?? [];
    }

    /**
     * Available serials for a given item + warehouse + location, with
     * server-side prefix search and a hard limit — the browser never receives
     * the full set. Ordered id ASC (FIFO, oldest received first) so
     * "auto-fill remaining" is simply the first N rows. Returns the total
     * matching count for "Showing X of N" UIs.
     */
    async findAvailable(
        ctx: RequestContext,
        params: {
            itemId: number;
            warehouseId: number;
            locationId: number;
            search?: string;
            limit?: number;
        },
    ): Promise<{
        rows: { id: number; serial_number: string; created_at: string }[];
        total: number;
    }> {
        const limit = Math.min(Math.max(params.limit ?? 50, 1), 200);
        let query = this.db
            .from(SERIAL_TABLE)
            .select('id, serial_number, created_at', { count: 'exact' })
            .eq('company_id', Number(ctx.companyId))
            .eq('item_id', params.itemId)
            .eq('warehouse_id', params.warehouseId)
            .eq('location_id', params.locationId)
            .eq('status', 'available');

        const search = params.search?.trim();
        if (search) {
            query = query.ilike('serial_number', `${search}%`);
        }

        const { data, error, count } = await query
            .order('id', { ascending: true })
            .limit(limit);

        if (error) throw new ApiError(error.message, 500, 'SERIAL_ERROR');
        return { rows: data ?? [], total: count ?? 0 };
    }

    /**
     * Mark serials sold with a guarded update. Only rows still `available` are
     * flipped; if fewer rows than requested change, another transaction already
     * took them → reject (prevents double-sell races).
     */
    async markSoldByIds(
        ctx: RequestContext,
        serialIds: number[],
        saleItemId: number,
        warehouseId: number,
        locationId: number,
    ): Promise<void> {
        if (!serialIds.length) return;

        const { data, error } = await this.db
            .from(SERIAL_TABLE)
            .update({ status: 'sold', sale_item_id: saleItemId })
            .in('id', serialIds)
            .eq('company_id', Number(ctx.companyId))
            .eq('status', 'available')
            .select('id');

        if (error) throw new ApiError(error.message, 400, 'SERIAL_ERROR');

        if ((data?.length ?? 0) !== serialIds.length) {
            throw new ApiError(
                'One or more selected serials are no longer available.',
                409,
                'SERIAL_NOT_AVAILABLE',
            );
        }

        await this.appendHistory(
            (data ?? []).map((row) => ({
                serial_id: row.id,
                transaction_type: 'sale',
                transaction_id: saleItemId,
                warehouse_id: warehouseId,
                location_id: locationId,
                status: 'sold',
            })),
        );
    }

    /** Serials for the Item Detail tab, with resolved names + document refs. */
    async findByItem(ctx: RequestContext, itemId: number) {
        const { data, error } = await this.db
            .from(SERIAL_TABLE)
            .select(
                `id, serial_number, status, warehouse_id, location_id,
                 warehouse:warehouse(id, name),
                 location:warehouse_location(id, name),
                 receipt_item:receipt_items(id, receipt:receipt_transaction(reference_no)),
                 sale_item:sales_shipment_items(id, shipment:sales_shipment(shipment_no)),
                 created_at, updated_at`,
            )
            .eq('company_id', Number(ctx.companyId))
            .eq('item_id', itemId)
            .order('created_at', { ascending: false });

        if (error) throw new ApiError(error.message, 500, 'SERIAL_ERROR');

        const first = <T>(v: T | T[] | null | undefined): T | null =>
            Array.isArray(v) ? (v[0] ?? null) : (v ?? null);

        return (data ?? []).map((r) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const row = r as any;
            const receiptItem = first(row.receipt_item);
            const saleItem = first(row.sale_item);
            return {
                id: row.id,
                serial_number: row.serial_number,
                status: row.status as InventorySerialStatus,
                warehouse_name: first(row.warehouse)?.name ?? '—',
                location_name: first(row.location)?.name ?? '—',
                receipt_reference:
                    first(receiptItem?.receipt)?.reference_no ?? null,
                sale_reference: first(saleItem?.shipment)?.shipment_no ?? null,
                created_at: row.created_at,
                updated_at: row.updated_at,
            };
        });
    }

    /** Append-only movement history for one serial (newest first). */
    async findHistory(ctx: RequestContext, serialId: number) {
        // Scope through the parent serial's company to prevent cross-tenant reads.
        const { data: serial, error: serialErr } = await this.db
            .from(SERIAL_TABLE)
            .select('id')
            .eq('id', serialId)
            .eq('company_id', Number(ctx.companyId))
            .maybeSingle();
        if (serialErr)
            throw new ApiError(serialErr.message, 500, 'SERIAL_ERROR');
        if (!serial) return [];

        const { data, error } = await this.db
            .from(HISTORY_TABLE)
            .select(
                `id, transaction_type, transaction_id, status, created_at,
                 warehouse:warehouse(id, name),
                 location:warehouse_location(id, name)`,
            )
            .eq('serial_id', serialId)
            .order('created_at', { ascending: false });

        if (error) throw new ApiError(error.message, 500, 'SERIAL_ERROR');

        const first = <T>(v: T | T[] | null | undefined): T | null =>
            Array.isArray(v) ? (v[0] ?? null) : (v ?? null);

        return (data ?? []).map((r) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const row = r as any;
            return {
                id: row.id,
                transaction_type: row.transaction_type,
                transaction_id: row.transaction_id,
                status: row.status as InventorySerialStatus,
                warehouse_name: first(row.warehouse)?.name ?? null,
                location_name: first(row.location)?.name ?? null,
                created_at: row.created_at,
            };
        });
    }
}
