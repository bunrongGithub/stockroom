import { getNextDocumentNumber } from '@/service/core/document-number';
import { ItemUomRepository } from '@/service/apps/inventory/repo/item-uom';
import { MovementRepository } from '@/service/apps/inventory/repo/movement';
import { SerialManagementService } from '@/service/apps/inventory/serial';
import { validateSerialSelection } from '@/service/apps/inventory/repo/serial-validation';
import { ApiError, NotFoundError } from '@/service/core/api-response';
import { BaseRepository } from '@/service/core/base-repository';
import type { QueryConfig } from '@/service/core/query/config.ts';
import type { QueryObject } from '@/service/core/query/types.ts';
import type {
    PaginatedResult,
    PaginationParams,
} from '@/service/core/pagination';
import type {
    CreateSalesShipmentInput,
    UpdateSalesShipmentInput,
} from '@/service/schema/sale-shipment.schema';
import type { RequestContext } from '@/types/request-context';
import type { AuditMeta } from '@/types/audit';
import type {
    SalesOrder,
    SalesShipment,
    SalesShipmentActions,
    SalesShipmentItem,
    SalesShipmentStatus,
} from '@/types/sales/order-management';
import { SalesOrderRepository } from './order';

const HEADER_TABLE = 'sales_shipment' as const;
const LINE_TABLE = 'sales_shipment_items' as const;

const SELECT_LIST =
    '*, sales_order:sales_order(id, order_no), warehouse:warehouse(id, name)';
const SELECT_DETAIL =
    '*, sales_order:sales_order(id, order_no), warehouse:warehouse(id, name), items:sales_shipment_items(*, item:inventory_item(id, name, track_serial), location:warehouse_location(id, name), item_uom:inventory_item_uom(id, name, display_name))';

/**
 * DRAFT shipments can be edited/posted/voided (POSTED is immutable). A POSTED
 * (i.e. shipped) shipment that is not yet invoiced can be invoiced.
 */
export function computeShipmentActions(
    status: SalesShipmentStatus,
): SalesShipmentActions {
    const isDraft = status === 'DRAFT';
    return {
        can_update: isDraft,
        can_post: isDraft,
        can_void: isDraft,
        // Invoiceable while there is remaining quantity to bill.
        can_invoice: status === 'POSTED' || status === 'PARTIALLY_INVOICED',
    };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapShipmentItem(r: any): SalesShipmentItem {
    return {
        id: r.id,
        sales_order_item_id: r.sales_order_item_id,
        item_id: r.item_id,
        product_name: r.item?.name ?? `#${r.item_id}`,
        track_serial: r.item?.track_serial ?? false,
        location_id: r.location_id,
        location_name: r.location?.name ?? '',
        item_uom_id: r.item_uom_id ?? null,
        uom: r.item_uom?.name ?? '',
        ordered_qty: Number(r.ordered_qty),
        previously_shipped_qty: Number(r.previously_shipped_qty),
        shipment_qty: Number(r.shipment_qty),
        serial_numbers: Array.isArray(r.serial_numbers) ? r.serial_numbers : [],
    };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapShipment(r: any): SalesShipment {
    return {
        id: r.id,
        shipment_no: r.shipment_no,
        reference_no: r.reference_no ?? null,
        sales_order_id: r.sales_order_id,
        sales_order_no: r.sales_order?.order_no ?? '',
        customer_name: r.customer_name ?? null,
        customer_phone: r.customer_phone ?? null,
        delivery_date: r.delivery_date,
        warehouse_id: r.warehouse_id,
        warehouse_name: r.warehouse?.name ?? '',
        status: r.status,
        receiver_name: r.receiver_name ?? null,
        delivery_address: r.delivery_address ?? null,
        notes: r.notes ?? null,
        created_at: r.created_at,
        updated_at: r.updated_at,
        items: (r.items ?? []).map(mapShipmentItem),
        actions: computeShipmentActions(r.status),
    };
}

/**
 * The repository's input, which is slightly wider than the HTTP schema: an
 * in-process caller (Cash Sale) ships to walk-in customers who have no phone.
 */
export type CreateSalesShipmentRepoInput = Omit<
    CreateSalesShipmentInput,
    'customer_phone'
> & { customer_phone?: string | null };

// ─── Repository ─────────────────────────────────────────────────────────────

export class SalesShipmentRepository extends BaseRepository {
    private static instance: SalesShipmentRepository;

    /**
     * Query Framework registry. No `selectableFields`: list rows run through
     * mapShipment(), which needs complete rows.
     */
    protected readonly queryConfig: QueryConfig = {
        table: HEADER_TABLE,
        searchable: [
            'shipment_no',
            'reference_no',
            'customer_name',
            'customer_phone',
        ],
        sortable: [
            'shipment_no',
            'customer_name',
            'delivery_date',
            'status',
            'created_at',
        ],
        filterable: {
            status: {
                type: 'enum',
                values: [
                    'DRAFT',
                    'POSTED',
                    'VOID',
                    'INVOICED',
                    'PARTIALLY_INVOICED',
                ],
            },
            warehouse_id: { type: 'foreign-key' },
            sales_order_id: { type: 'foreign-key' },
            delivery_date: { type: 'date' },
            created_at: { type: 'date' },
        },
        relations: {
            sales_order: {
                table: 'sales_order',
                columns: ['id', 'order_no'],
                always: true,
            },
            warehouse: { table: 'warehouse', columns: ['id', 'name'], always: true },
        },
        defaultSort: [{ field: 'id', direction: 'desc' }],
    };

    /** Standardized list path (Query Framework). */
    async findAllV2(
        ctx: RequestContext,
        query: QueryObject,
    ): Promise<PaginatedResult<SalesShipment>> {
        return this.findAllQuery<SalesShipment>(ctx, query, {
            enrichAudit: true,
            map: mapShipment,
        });
    }

    static getInstance(): SalesShipmentRepository {
        if (!SalesShipmentRepository.instance) {
            SalesShipmentRepository.instance = new SalesShipmentRepository();
        }
        return SalesShipmentRepository.instance;
    }

    async findAll(
        ctx: RequestContext,
        params: PaginationParams & { salesOrderId?: number },
    ): Promise<PaginatedResult<SalesShipment>> {
        const isSuperUser = await this.isSupperUser(ctx);
        let query = this.applyFilter(
            this.db.from(HEADER_TABLE).select(SELECT_LIST, { count: 'exact' }),
            ctx,
            isSuperUser,
        ).order('id', { ascending: false });
        // An order's own shipments (its detail page) — filtered server-side.
        if (params.salesOrderId) {
            query = query.eq('sales_order_id', params.salesOrderId);
        }
        // Search matches the system number OR the user reference number.
        if (params.search) {
            query = query.or(
                `shipment_no.ilike.%${params.search}%,reference_no.ilike.%${params.search}%`,
            );
        }
        const result = await this.paginate<Record<string, unknown>>(query, {
            ...params,
            search: undefined,
            searchColumn: undefined,
        });
        return { ...result, data: result.data.map(mapShipment) };
    }

    async findOne(
        ctx: RequestContext,
        id: number,
    ): Promise<(SalesShipment & Partial<AuditMeta>) | null> {
        const isSuperUser = await this.isSupperUser(ctx);
        const { data, error } = await this.applyFilter(
            this.db.from(HEADER_TABLE).select(SELECT_DETAIL).eq('id', id),
            ctx,
            isSuperUser,
        ).maybeSingle();
        if (error) throw new ApiError(error.message, 500);
        if (!data) return null;
        return this.enrichAuditOne({
            ...mapShipment(data),
            created_by:
                (data as { created_by?: string | null }).created_by ?? null,
            updated_by:
                (data as { updated_by?: string | null }).updated_by ?? null,
        });
    }

    async insertOne(
        ctx: RequestContext,
        input: CreateSalesShipmentRepoInput,
    ): Promise<SalesShipment> {
        const companyId = Number(ctx.companyId);
        const order = await this.loadShippableOrder(ctx, input.sales_order_id);
        this.validateLines(order, input.items);

        const shipment_no = await getNextDocumentNumber(
            ctx,
            'sales_shipment',
            'SHP',
        );
        const { data: header, error } = await this.db
            .from(HEADER_TABLE)
            .insert(
                this.stampCreate(ctx, {
                    company_id: companyId,
                    user_id: ctx.userId,
                    shipment_no,
                    reference_no: input.reference_no ?? null,
                    sales_order_id: input.sales_order_id,
                    customer_name: input.customer_name ?? order.customer_name,
                    customer_phone:
                        input.customer_phone ?? order.customer_phone,
                    delivery_date: input.delivery_date,
                    warehouse_id: input.warehouse_id ?? order.warehouse_id,
                    status: 'DRAFT',
                    receiver_name: input.receiver_name ?? null,
                    delivery_address: input.delivery_address ?? null,
                    notes: input.notes ?? null,
                }),
            )
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
        input: UpdateSalesShipmentInput,
    ): Promise<SalesShipment> {
        const companyId = Number(ctx.companyId);
        const existing = await this.findOne(ctx, id);
        if (!existing) throw new NotFoundError('Shipment not found');
        if (existing.status !== 'DRAFT') {
            throw new ApiError(
                'Only DRAFT shipments can be edited',
                400,
                'INVALID_STATUS',
            );
        }

        const { error } = await this.db
            .from(HEADER_TABLE)
            .update(
                this.stampUpdate(ctx, {
                    reference_no: input.reference_no ?? null,
                    customer_name: input.customer_name ?? null,
                    customer_phone: input.customer_phone ?? null,
                    delivery_date: input.delivery_date,
                    warehouse_id: input.warehouse_id,
                    receiver_name: input.receiver_name ?? null,
                    delivery_address: input.delivery_address ?? null,
                    notes: input.notes ?? null,
                }),
            )
            .eq('id', id)
            .eq('company_id', companyId);
        if (error) throw new ApiError(error.message, 500);

        if (input.items) {
            const order = await this.loadShippableOrder(
                ctx,
                existing.sales_order_id,
            );
            this.validateLines(order, input.items);
            await this.db.from(LINE_TABLE).delete().eq('shipment_id', id);
            await this.insertLines(companyId, id, input.items);
        }

        return (await this.findOne(ctx, id))!;
    }

    async deleteOne(ctx: RequestContext, id: number): Promise<void> {
        const existing = await this.findOne(ctx, id);
        if (!existing) throw new NotFoundError('Shipment not found');
        if (existing.status !== 'DRAFT') {
            throw new ApiError(
                'Only DRAFT shipments can be deleted',
                400,
                'INVALID_STATUS',
            );
        }
        const { error } = await this.db
            .from(HEADER_TABLE)
            .delete()
            .eq('id', id)
            .eq('company_id', Number(ctx.companyId));
        if (error) throw new ApiError(error.message, 500);
    }

    /**
     * Post a shipment: DRAFT → POSTED.
     *   1. Record an OUT inventory movement (stock decremented; 422 if short).
     *   2. Accrue shipped_qty on the order lines + recompute order status.
     *   3. Mark the shipment POSTED.
     * The movement engine is the stock guard; it rolls itself back on failure.
     */
    async postOne(ctx: RequestContext, id: number): Promise<SalesShipment> {
        const companyId = Number(ctx.companyId);
        const shipment = await this.findOne(ctx, id);
        if (!shipment) throw new NotFoundError('Shipment not found');
        if (shipment.status !== 'DRAFT') {
            throw new ApiError(
                'Only DRAFT shipments can be posted',
                400,
                'INVALID_STATUS',
            );
        }
        if (!shipment.items.length) {
            throw new ApiError('Shipment has no items to post', 400);
        }

        const itemUomService = ItemUomRepository.getInstance();
        const orderService = SalesOrderRepository.getInstance();
        const serialRepo = SerialManagementService.getInstance();

        // Build movement lines, converting entered qty → base UOM.
        const movementItems = await Promise.all(
            shipment.items.map(async (line) => {
                const enteredUom = line.item_uom_id
                    ? await itemUomService.findOne(ctx, line.item_uom_id)
                    : null;
                const baseUom = await itemUomService.findDefaultByItem(
                    ctx,
                    line.item_id,
                );
                const conversion = Number(enteredUom?.conversion ?? 1) || 1;

                return {
                    item_id: line.item_id,
                    warehouse_id: shipment.warehouse_id,
                    location_id: line.location_id,
                    entered_qty: line.shipment_qty,
                    entered_uom_id: enteredUom?.uom_id ?? null,
                    base_qty: line.shipment_qty * conversion,
                    base_uom_id: baseUom?.uom_id ?? null,
                    movement_direction: 'OUT' as const,
                };
            }),
        );

        // Validate serial selections BEFORE moving stock. For each serial-tracked
        // line: count must match qty, and every serial must exist as `available`
        // in the shipment's warehouse + the line's location (§10/§11/§12). The
        // resolved serial ids are captured so they can be marked sold post-move.
        const serialItemIds = [...new Set(shipment.items.map((l) => l.item_id))];
        const { data: trackRows, error: trackErr } = await this.db
            .from('inventory_item')
            .select('id, track_serial')
            .in('id', serialItemIds);
        if (trackErr) throw new ApiError(trackErr.message, 500);
        const trackMap = new Map(
            (trackRows ?? []).map((r) => [r.id, r.track_serial]),
        );

        const serialPlan: {
            lineId: number;
            serialIds: number[];
            locationId: number;
        }[] = [];
        for (const line of shipment.items) {
            if (!trackMap.get(line.item_id)) continue;
            const serials = [
                ...new Set(
                    (
                        (line as typeof line & { serial_numbers?: string[] })
                            .serial_numbers ?? []
                    )
                        .map((s) => s.trim())
                        .filter(Boolean),
                ),
            ];
            try {
                validateSerialSelection({
                    quantity: Number(line.shipment_qty),
                    serials,
                });
            } catch (e) {
                throw new ApiError(
                    e instanceof Error
                        ? e.message
                        : 'Invalid serial selection',
                    400,
                    'SERIAL_QUANTITY',
                );
            }
            const rows = await serialRepo.findSelectableForSale(ctx, {
                itemId: line.item_id,
                warehouseId: shipment.warehouse_id,
                locationId: line.location_id,
                serialNumbers: serials,
            });
            if (rows.length !== serials.length) {
                throw new ApiError(
                    `One or more serials for "${line.product_name}" are not available in the selected warehouse/location.`,
                    400,
                    'SERIAL_UNAVAILABLE',
                );
            }
            serialPlan.push({
                lineId: line.id,
                serialIds: rows.map((r) => r.id),
                locationId: line.location_id,
            });
        }

        // 1. Stock movement — throws INSUFFICIENT_STOCK (422) if unavailable.
        await MovementRepository.getInstance().createMovement(ctx, {
            movement_type: 'SALE_SHIPMENT',
            movement_date: shipment.delivery_date,
            source_module: 'sale',
            source_document_type: 'sale_shipment',
            source_document_id: shipment.id,
            remarks: shipment.notes,
            items: movementItems,
        });

        // Past this point stock has physically left the warehouse, so every
        // remaining step must either complete or be undone — a serial that was
        // taken by a concurrent sale (409) must not strand the deducted stock.
        try {
            // 2. Accrue shipped quantities + recompute order status.
            await orderService.incrementShipped(
                ctx,
                shipment.items.map((l) => ({
                    sales_order_item_id: l.sales_order_item_id,
                    qty: l.shipment_qty,
                })),
            );
            await orderService.recomputeStatus(ctx, shipment.sales_order_id);

            // 3. Mark the resolved serials sold (guarded update + history).
            for (const plan of serialPlan) {
                await serialRepo.markSoldByIds(
                    ctx,
                    plan.serialIds,
                    plan.lineId,
                    shipment.warehouse_id,
                    plan.locationId,
                );
            }

            // 4. Mark posted.
            const { error } = await this.db
                .from(HEADER_TABLE)
                .update(this.stampUpdate(ctx, { status: 'POSTED' }))
                .eq('id', id)
                .eq('company_id', companyId);
            if (error) throw new ApiError(error.message, 500);
        } catch (err) {
            await this.undoPosting(ctx, shipment);
            throw err;
        }

        return (await this.findOne(ctx, id))!;
    }

    /**
     * Undo a POSTED shipment: serials go back to `available`, the stock movement
     * is mirrored back IN, the order's shipped quantities are re-derived and the
     * shipment returns to DRAFT.
     *
     * This is what makes the sales chain compensable — a Cash Sale that fails at
     * invoicing or payment unwinds to zero instead of stranding stock. An
     * invoiced shipment is refused: cancel/delete its invoices first (that is
     * what the orchestrator's compensation order does).
     */
    async reversePosting(ctx: RequestContext, id: number): Promise<SalesShipment> {
        const shipment = await this.findOne(ctx, id);
        if (!shipment) throw new NotFoundError('Shipment not found');
        if (shipment.status !== 'POSTED') {
            throw new ApiError(
                `Only a POSTED shipment can be reversed (this one is ${shipment.status}). Cancel its invoices first.`,
                400,
                'INVALID_STATUS',
            );
        }
        await this.undoPosting(ctx, shipment);
        return (await this.findOne(ctx, id))!;
    }

    /**
     * The reversal itself, shared by `reversePosting` and `postOne`'s failure
     * path. Every step is derived from current state (which serials are actually
     * sold, which movement is actually posted), so it is safe to run against a
     * partially-applied posting.
     */
    private async undoPosting(
        ctx: RequestContext,
        shipment: SalesShipment,
    ): Promise<void> {
        const companyId = Number(ctx.companyId);
        const serialRepo = SerialManagementService.getInstance();
        const movementRepo = MovementRepository.getInstance();

        // 1. Un-sell serials (guarded: only rows still `sold` for these lines).
        const lineIds = shipment.items.map((l) => l.id);
        const sold = await serialRepo.findSoldBySaleItemIds(ctx, lineIds);
        if (sold.length) {
            const byLocation = new Map<string, typeof sold>();
            for (const s of sold) {
                const key = `${s.warehouse_id}:${s.location_id}`;
                byLocation.set(key, [...(byLocation.get(key) ?? []), s]);
            }
            for (const group of byLocation.values()) {
                await serialRepo.markReturnedByIds(
                    ctx,
                    group.map((s) => s.id),
                    shipment.id,
                    group[0].warehouse_id,
                    group[0].location_id,
                );
            }
        }

        // 2. Put the stock back through the movement engine (mirror movement).
        const movement = await movementRepo.findBySource(
            ctx,
            'sale_shipment',
            shipment.id,
        );
        if (movement) {
            await movementRepo.reverseMovement(ctx, movement.id, {
                movement_type: 'SALE_RETURN',
                remarks: `Reversal of shipment ${shipment.shipment_no}`,
            });
        }

        // 3. Back to DRAFT, then re-derive the order from the shipments that
        //    remain posted (this one no longer counts).
        const { error } = await this.db
            .from(HEADER_TABLE)
            .update(this.stampUpdate(ctx, { status: 'DRAFT' }))
            .eq('id', shipment.id)
            .eq('company_id', companyId);
        if (error) throw new ApiError(error.message, 500);

        const orderService = SalesOrderRepository.getInstance();
        await orderService.recomputeShippedQty(ctx, shipment.sales_order_id);
        await orderService.recomputeStatus(ctx, shipment.sales_order_id);
    }

    /** Void a DRAFT shipment (POSTED cannot be voided — reverse via a return). */
    async voidOne(ctx: RequestContext, id: number): Promise<SalesShipment> {
        const existing = await this.findOne(ctx, id);
        if (!existing) throw new NotFoundError('Shipment not found');
        if (existing.status === 'VOID') {
            throw new ApiError(
                'Shipment is already voided',
                400,
                'INVALID_STATUS',
            );
        }
        if (existing.status === 'POSTED') {
            throw new ApiError(
                'Posted shipments cannot be voided. Create a return instead.',
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
        return (await this.findOne(ctx, id))!;
    }

    /**
     * Quantity already invoiced per shipment line = SUM of invoice-line quantity
     * across NON-CANCELLED invoices, grouped by shipment_item_id. The single
     * source of truth for invoicing progress (computed, never stored). Pass
     * `excludeInvoiceId` when validating an edit so the invoice's own lines are
     * not double-counted.
     */
    async getInvoicedQtyByShipmentItem(
        ctx: RequestContext,
        shipmentId: number,
        excludeInvoiceId?: number,
    ): Promise<Map<number, number>> {
        let query = this.db
            .from('sales_invoice_items')
            .select('shipment_item_id, quantity, invoice:sales_invoice!inner(id, status, shipment_id)')
            .eq('company_id', Number(ctx.companyId))
            .eq('invoice.shipment_id', shipmentId)
            .neq('invoice.status', 'CANCELLED');
        if (excludeInvoiceId) {
            query = query.neq('invoice.id', excludeInvoiceId);
        }
        const { data, error } = await query;
        if (error) throw new ApiError(error.message, 500);

        const map = new Map<number, number>();
        for (const row of data ?? []) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const r = row as any;
            if (r.shipment_item_id == null) continue;
            map.set(
                r.shipment_item_id,
                (map.get(r.shipment_item_id) ?? 0) + Number(r.quantity),
            );
        }
        return map;
    }

    /**
     * Derive a shipped shipment's status from invoiced vs shipped quantity:
     *   every item invoiced 0            → POSTED (shipped, nothing invoiced)
     *   every item fully invoiced        → INVOICED
     *   otherwise                        → PARTIALLY_INVOICED
     * DRAFT/VOID shipments are left untouched. Call after any invoice change.
     */
    async recomputeInvoiceStatus(
        ctx: RequestContext,
        shipmentId: number,
    ): Promise<void> {
        const companyId = Number(ctx.companyId);
        const { data: header } = await this.db
            .from(HEADER_TABLE)
            .select('status')
            .eq('id', shipmentId)
            .eq('company_id', companyId)
            .maybeSingle();
        if (
            !header ||
            !['POSTED', 'PARTIALLY_INVOICED', 'INVOICED'].includes(
                header.status,
            )
        ) {
            return;
        }

        const { data: items, error } = await this.db
            .from(LINE_TABLE)
            .select('id, shipment_qty')
            .eq('shipment_id', shipmentId)
            .eq('company_id', companyId);
        if (error) throw new ApiError(error.message, 500);

        const invoiced = await this.getInvoicedQtyByShipmentItem(
            ctx,
            shipmentId,
        );

        let anyInvoiced = false;
        let anyRemaining = false;
        for (const it of items ?? []) {
            const inv = invoiced.get(it.id) ?? 0;
            if (inv > 0) anyInvoiced = true;
            if (Number(it.shipment_qty) - inv > 0) anyRemaining = true;
        }

        const status = !anyInvoiced
            ? 'POSTED'
            : anyRemaining
              ? 'PARTIALLY_INVOICED'
              : 'INVOICED';

        await this.db
            .from(HEADER_TABLE)
            .update(this.stampUpdate(ctx, { status }))
            .eq('id', shipmentId)
            .eq('company_id', companyId);
    }

    // ── internals ───────────────────────────────────────────────────────────

    private async loadShippableOrder(
        ctx: RequestContext,
        orderId: number,
    ): Promise<SalesOrder> {
        const order = await SalesOrderRepository.getInstance().findOne(
            ctx,
            orderId,
        );
        if (!order) throw new NotFoundError('Sales order not found');
        if (order.status === 'cancelled' || order.status === 'closed') {
            throw new ApiError(
                `Cannot ship a ${order.status} order`,
                400,
                'INVALID_STATUS',
            );
        }
        return order;
    }

    private validateLines(
        order: SalesOrder,
        lines: { sales_order_item_id: number; shipment_qty: number }[],
    ): void {
        const byId = new Map(order.items.map((i) => [i.id, i]));
        for (const line of lines) {
            const soItem = byId.get(line.sales_order_item_id);
            if (!soItem) {
                throw new ApiError(
                    `Order line ${line.sales_order_item_id} not found on this order`,
                    400,
                );
            }
            const remaining = soItem.ordered_qty - soItem.shipped_qty;
            if (line.shipment_qty <= 0) {
                throw new ApiError(
                    `Shipment quantity must be greater than zero for ${soItem.product_name}`,
                    400,
                );
            }
            if (line.shipment_qty > remaining) {
                throw new ApiError(
                    `Shipment quantity for ${soItem.product_name} exceeds remaining (${remaining})`,
                    400,
                );
            }
        }
    }

    private async insertLines(
        companyId: number,
        shipmentId: number,
        items: CreateSalesShipmentInput['items'],
    ): Promise<void> {
        const rows = items.map((l) => ({
            shipment_id: shipmentId,
            company_id: companyId,
            sales_order_item_id: l.sales_order_item_id,
            item_id: l.item_id,
            location_id: l.location_id,
            item_uom_id: l.item_uom_id ?? null,
            ordered_qty: l.ordered_qty ?? 0,
            previously_shipped_qty: l.previously_shipped_qty ?? 0,
            shipment_qty: l.shipment_qty,
            serial_numbers: l.serial_numbers ?? [],
        }));
        const { error } = await this.db.from(LINE_TABLE).insert(rows);
        if (error) throw new ApiError(error.message, 500);
    }
}
