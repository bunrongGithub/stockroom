import { BaseRepository } from '@/service/core/base-repository';
import type { QueryConfig } from '@/service/core/query/config.ts';
import type { QueryObject } from '@/service/core/query/types.ts';
import type {
    PaginationParams,
    PaginatedResult,
} from '@/service/core/pagination';
import type { RequestContext } from '@/types/request-context';
import type { AuditMeta } from '@/types/audit';
import { getNextDocumentNumber } from '@/service/core/document-number';
import {
    lineTotal as calcLineTotal,
    documentTotals,
} from '../pricing';
import { ApiError, NotFoundError } from '@/service/core/api-response';
import { behaviorOf } from '@/service/core/item-behavior';
import type {
    CreateSalesOrderInput,
    UpdateSalesOrderInput,
} from '@/service/schema/sale-order.schema';
import type {
    SalesOrder,
    SalesOrderItem,
    SalesOrderStatus,
    SalesOrderActions,
} from '@/types/sales/order-management';

const HEADER_TABLE = 'sales_order' as const;
const LINE_TABLE = 'sales_order_items' as const;
const SHIPMENT_TABLE = 'sales_shipment' as const;

const SELECT_LIST =
    '*, warehouse:warehouse(id, name), customer:business_partner(id, code, name)';
const SELECT_DETAIL =
    '*, warehouse:warehouse(id, name), customer:business_partner(id, code, name), items:sales_order_items(*, item:inventory_item(id, name, track_serial), item_uom:inventory_item_uom(id, name, display_name))';

// ─── Pure helpers ───────────────────────────────────────────────────────────

// Thin adapters over the shared sales pricing util (order lines use `ordered_qty`).
type LineCalcInput = {
    ordered_qty: number;
    unit_price: number;
    discount: number;
    tax: number;
};

function lineTotal(l: LineCalcInput) {
    return calcLineTotal({
        quantity: l.ordered_qty,
        unit_price: l.unit_price,
        discount: l.discount,
        tax: l.tax,
    });
}

function orderTotals(lines: LineCalcInput[]) {
    return documentTotals(
        lines.map((l) => ({
            quantity: l.ordered_qty,
            unit_price: l.unit_price,
            discount: l.discount,
            tax: l.tax,
        })),
    );
}

// Pure fulfillment derivation lives in ../fulfillment (unit-tested there);
// re-exported so existing imports keep working.
import { deriveOrderStatus } from '../fulfillment';
export { deriveOrderStatus };

/**
 * Editing/cancelling/closing/shipping are only allowed while the order is
 * still active. Line edits are restricted to `open` (once shipping begins the
 * lines are referenced by shipment rows and become immutable).
 */
export function computeOrderActions(
    status: SalesOrderStatus,
): SalesOrderActions {
    const active = status === 'open' || status === 'partial_shipment';
    return {
        can_update: status === 'open',
        can_cancel: active,
        can_close: active,
        can_ship: active,
    };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapOrderItem(r: any): SalesOrderItem {
    return {
        id: r.id,
        item_id: r.item_id,
        item_uom_id: r.item_uom_id ?? null,
        item_class: r.item_class ?? 'stock',
        track_serial: r.item?.track_serial ?? false,
        product_name: r.item?.name ?? r.description ?? '',
        description: r.description ?? '',
        uom: r.uom ?? r.item_uom?.name ?? '',
        ordered_qty: Number(r.ordered_qty),
        shipped_qty: Number(r.shipped_qty),
        invoiced_qty: Number(r.invoiced_qty ?? 0),
        unit_price: Number(r.unit_price),
        discount: Number(r.discount),
        tax: Number(r.tax),
        line_total: Number(r.line_total),
    };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapOrder(r: any): SalesOrder {
    return {
        id: r.id,
        order_no: r.order_no,
        reference_no: r.reference_no ?? null,
        customer_id: r.customer_id ?? null,
        customer_code: r.customer?.code ?? null,
        customer_name: r.customer_name,
        customer_phone: r.customer_phone ?? null,
        order_date: r.order_date,
        expected_delivery_date: r.expected_delivery_date ?? null,
        warehouse_id: r.warehouse_id,
        warehouse_name: r.warehouse?.name ?? '',
        currency: r.currency,
        status: r.status,
        subtotal: Number(r.subtotal),
        discount_total: Number(r.discount_total),
        tax_total: Number(r.tax_total),
        grand_total: Number(r.grand_total),
        notes: r.notes ?? null,
        created_at: r.created_at,
        updated_at: r.updated_at,
        items: (r.items ?? []).map(mapOrderItem),
        actions: computeOrderActions(r.status),
    };
}

/**
 * What the repository accepts, as opposed to what the HTTP schema accepts. The
 * zod schema is the API contract for the Sales Order form, which requires a
 * Business Partner and a phone. An in-process caller — the Cash Sale
 * orchestrator — serves anonymous walk-ins who have neither: a counter sale must
 * never stop to ask who someone is. It also stamps the channel/idempotency
 * fields the form has no notion of.
 */
export type CreateSalesOrderRepoInput = Omit<
    CreateSalesOrderInput,
    'customer_phone' | 'customer_id'
> & {
    customer_phone?: string | null;
    customer_id?: number | null;
    source_channel?: 'sales_order' | 'cash_sale';
    idempotency_key?: string | null;
};

// ─── Repository ─────────────────────────────────────────────────────────────

export class SalesOrderRepository extends BaseRepository {
    private static instance: SalesOrderRepository;

    /**
     * Query Framework registry. No `selectableFields`: list rows run through
     * mapOrder(), which needs complete rows — a client projection would
     * break it, so `fields=` is rejected on this repository.
     */
    protected readonly queryConfig: QueryConfig = {
        table: HEADER_TABLE,
        searchable: ['order_no', 'reference_no', 'customer_name', 'customer_phone'],
        sortable: [
            'order_no',
            'customer_name',
            'order_date',
            'status',
            'grand_total',
            'created_at',
        ],
        filterable: {
            status: {
                type: 'enum',
                values: ['open', 'partial_shipment', 'closed', 'cancelled'],
            },
            warehouse_id: { type: 'foreign-key' },
            customer_id: { type: 'foreign-key' },
            order_date: { type: 'date' },
            created_at: { type: 'date' },
            grand_total: { type: 'number' },
        },
        relations: {
            warehouse: { table: 'warehouse', columns: ['id', 'name'], always: true },
        },
        defaultSort: [{ field: 'id', direction: 'desc' }],
    };

    /**
     * Standardized list path. The source channel is pinned server-side:
     * counter (cash) sales are real sales orders but belong on the Cash Sale
     * list, and a client filter must never mix the two pipelines.
     */
    async findAllV2(
        ctx: RequestContext,
        query: QueryObject,
        sourceChannel: 'sales_order' | 'cash_sale',
    ): Promise<PaginatedResult<SalesOrder>> {
        return this.findAllQuery<SalesOrder>(ctx, query, {
            enrichAudit: true,
            forced: [
                { column: 'source_channel', operator: 'eq', value: sourceChannel },
            ],
            map: mapOrder,
        });
    }

    static getInstance(): SalesOrderRepository {
        if (!SalesOrderRepository.instance) {
            SalesOrderRepository.instance = new SalesOrderRepository();
        }
        return SalesOrderRepository.instance;
    }

    async findAll(
        ctx: RequestContext,
        params: PaginationParams & {
            sourceChannel?: 'sales_order' | 'cash_sale';
        },
    ): Promise<PaginatedResult<SalesOrder>> {
        const isSuperUser = await this.isSupperUser(ctx);
        let query = this.applyFilter(
            this.db.from(HEADER_TABLE).select(SELECT_LIST, { count: 'exact' }),
            ctx,
            isSuperUser,
        ).order('id', { ascending: false });
        // Counter sales are real sales orders, but they belong on the Cash Sale
        // list, not in the order pipeline the sales desk works through.
        if (params.sourceChannel) {
            query = query.eq('source_channel', params.sourceChannel);
        }
        // Search matches the system number OR the user reference number.
        if (params.search) {
            query = query.or(
                `order_no.ilike.%${params.search}%,reference_no.ilike.%${params.search}%`,
            );
        }
        const result = await this.paginate<Record<string, unknown>>(query, {
            ...params,
            search: undefined,
            searchColumn: undefined,
        });
        return { ...result, data: result.data.map(mapOrder) };
    }

    async findOne(
        ctx: RequestContext,
        id: number,
    ): Promise<(SalesOrder & Partial<AuditMeta>) | null> {
        const isSuperUser = await this.isSupperUser(ctx);
        const { data, error } = await this.applyFilter(
            this.db.from(HEADER_TABLE).select(SELECT_DETAIL).eq('id', id),
            ctx,
            isSuperUser,
        ).maybeSingle();
        if (error) throw new ApiError(error.message, 500);
        if (!data) return null;
        return this.enrichAuditOne({
            ...mapOrder(data),
            created_by:
                (data as { created_by?: string | null }).created_by ?? null,
            updated_by:
                (data as { updated_by?: string | null }).updated_by ?? null,
        });
    }

    /** The order a previous request already created for this key, if any. */
    async findByIdempotencyKey(
        ctx: RequestContext,
        key: string,
    ): Promise<SalesOrder | null> {
        const { data, error } = await this.db
            .from(HEADER_TABLE)
            .select(SELECT_DETAIL)
            .eq('company_id', Number(ctx.companyId))
            .eq('idempotency_key', key)
            .maybeSingle();
        if (error) throw new ApiError(error.message, 500);
        return data ? mapOrder(data) : null;
    }

    async insertOne(
        ctx: RequestContext,
        input: CreateSalesOrderRepoInput,
    ): Promise<SalesOrder> {
        const companyId = Number(ctx.companyId);
        // Snapshot each line's item class up-front; the warehouse rule and
        // all later routing derive from the snapshot, not live item rows.
        const classes = await this.classesFor(
            companyId,
            input.items.map((l) => l.item_id),
        );
        this.assertWarehouseRule(input.warehouse_id ?? null, [
            ...classes.values(),
        ]);

        const order_no = await getNextDocumentNumber(ctx, 'sales_order', 'SO');
        const totals = orderTotals(input.items);

        const { data: header, error } = await this.db
            .from(HEADER_TABLE)
            .insert(
                this.stampCreate(ctx, {
                    company_id: companyId,
                    user_id: ctx.userId,
                    order_no,
                    reference_no: input.reference_no ?? null,
                    customer_name: input.customer_name,
                    customer_phone: input.customer_phone ?? null,
                    customer_id: input.customer_id ?? null,
                    source_channel: input.source_channel ?? 'sales_order',
                    idempotency_key: input.idempotency_key ?? null,
                    order_date: input.order_date,
                    expected_delivery_date:
                        input.expected_delivery_date ?? null,
                    warehouse_id: input.warehouse_id ?? null,
                    currency: input.currency ?? 'USD',
                    status: 'open',
                    ...totals,
                    notes: input.notes ?? null,
                }),
            )
            .select()
            .single();

        if (error) throw new ApiError(error.message, 500);

        try {
            await this.insertLines(companyId, header.id, input.items, classes);
        } catch (err) {
            await this.db.from(HEADER_TABLE).delete().eq('id', header.id);
            throw err;
        }

        return (await this.findOne(ctx, header.id))!;
    }

    /** Load item classes for a set of items, scoped to the company. */
    private async classesFor(
        companyId: number,
        itemIds: number[],
    ): Promise<Map<number, string>> {
        const unique = [...new Set(itemIds)];
        if (unique.length === 0) return new Map();
        const { data, error } = await this.db
            .from('inventory_item')
            .select('id, item_class')
            .eq('company_id', companyId)
            .in('id', unique);
        if (error) throw new ApiError(error.message, 500);
        const map = new Map<number, string>(
            (data ?? []).map((r) => [r.id as number, r.item_class as string]),
        );
        const missing = unique.filter((id) => !map.has(id));
        if (missing.length) {
            throw new ApiError(
                `Item #${missing[0]} not found`,
                404,
                'ITEM_NOT_FOUND',
            );
        }
        return map;
    }

    /** A warehouse is required exactly when the order has shippable lines. */
    private assertWarehouseRule(
        warehouseId: number | null,
        itemClasses: string[],
    ): void {
        const needsWarehouse = itemClasses.some(
            (c) => behaviorOf(c).requiresWarehouse,
        );
        if (needsWarehouse && !warehouseId) {
            throw new ApiError(
                'A warehouse is required when the order contains stock items',
                422,
                'WAREHOUSE_REQUIRED',
            );
        }
    }

    async updateOne(
        ctx: RequestContext,
        id: number,
        input: UpdateSalesOrderInput,
    ): Promise<SalesOrder> {
        const companyId = Number(ctx.companyId);
        const existing = await this.findOne(ctx, id);
        if (!existing) throw new NotFoundError('Sales order not found');
        // Only editable before any shipment has begun.
        if (existing.status !== 'open') {
            throw new ApiError(
                `Cannot edit a ${existing.status} order`,
                400,
                'INVALID_STATUS',
            );
        }

        // Warehouse rule against the lines the order will have after this
        // update (submitted lines when replacing, current lines otherwise).
        const lineClasses = input.items
            ? [
                  ...(
                      await this.classesFor(
                          companyId,
                          input.items.map((l) => l.item_id),
                      )
                  ).values(),
              ]
            : existing.items.map((l) => l.item_class);
        this.assertWarehouseRule(input.warehouse_id ?? null, lineClasses);

        const totals = input.items
            ? orderTotals(input.items)
            : {
                  subtotal: existing.subtotal,
                  discount_total: existing.discount_total,
                  tax_total: existing.tax_total,
                  grand_total: existing.grand_total,
              };

        const { error } = await this.db
            .from(HEADER_TABLE)
            .update(
                this.stampUpdate(ctx, {
                    reference_no: input.reference_no ?? null,
                    customer_name: input.customer_name,
                    customer_phone: input.customer_phone ?? null,
                    // Keeping the link in sync on update: it used to be written
                    // only on insert, so re-saving an order silently detached it
                    // from the partner master.
                    ...(input.customer_id !== undefined && {
                        customer_id: input.customer_id ?? null,
                    }),
                    order_date: input.order_date,
                    expected_delivery_date:
                        input.expected_delivery_date ?? null,
                    warehouse_id: input.warehouse_id ?? null,
                    currency: input.currency ?? 'USD',
                    notes: input.notes ?? null,
                    ...totals,
                }),
            )
            .eq('id', id)
            .eq('company_id', companyId);

        if (error) throw new ApiError(error.message, 500);

        if (input.items) {
            await this.syncLines(companyId, id, input.items);
        }

        return (await this.findOne(ctx, id))!;
    }

    /**
     * Idempotently synchronise order lines with the submitted payload:
     *   • lines carrying an `id` that still exist are UPDATED in place
     *   • lines without an `id` are INSERTED
     *   • existing lines absent from the payload are DELETED
     * A removed line that a shipment already references is rejected (you cannot
     * un-order something that has been shipped). Every DB error is surfaced, so
     * a failed delete can never silently fall through to an append.
     */
    private async syncLines(
        companyId: number,
        orderId: number,
        items: UpdateSalesOrderInput['items'],
    ): Promise<void> {
        const submitted = items ?? [];
        const classes = await this.classesFor(
            companyId,
            submitted.map((l) => l.item_id),
        );

        const { data: existingRows, error: exErr } = await this.db
            .from(LINE_TABLE)
            .select('id, shipped_qty, invoiced_qty')
            .eq('order_id', orderId)
            .eq('company_id', companyId);
        if (exErr) throw new ApiError(exErr.message, 500);

        const existing = new Map(
            (existingRows ?? []).map((r) => [
                r.id as number,
                {
                    shipped: Number(r.shipped_qty),
                    invoiced: Number(r.invoiced_qty ?? 0),
                },
            ]),
        );
        const submittedIds = new Set(
            submitted
                .map((l) => l.id)
                .filter((v): v is number => typeof v === 'number'),
        );

        // ── 1. Delete lines that were removed from the order ──────────────────
        const toDelete = [...existing.keys()].filter(
            (eid) => !submittedIds.has(eid),
        );
        if (toDelete.length) {
            const { data: refs, error: refErr } = await this.db
                .from('sales_shipment_items')
                .select('sales_order_item_id')
                .in('sales_order_item_id', toDelete);
            if (refErr) throw new ApiError(refErr.message, 500);
            if (refs && refs.length) {
                throw new ApiError(
                    'Cannot remove an item that is already used in a shipment.',
                    409,
                    'ITEM_IN_SHIPMENT',
                );
            }
            // Direct-invoice lines are referenced by invoice lines instead of
            // shipment lines — protect them the same way.
            const { data: invRefs, error: invRefErr } = await this.db
                .from('sales_invoice_items')
                .select('sales_order_item_id, invoice:sales_invoice!inner(status)')
                .in('sales_order_item_id', toDelete)
                .neq('invoice.status', 'CANCELLED');
            if (invRefErr) throw new ApiError(invRefErr.message, 500);
            if (invRefs && invRefs.length) {
                throw new ApiError(
                    'Cannot remove an item that is already used in an invoice.',
                    409,
                    'ITEM_IN_INVOICE',
                );
            }
            const { error: delErr } = await this.db
                .from(LINE_TABLE)
                .delete()
                .in('id', toDelete)
                .eq('company_id', companyId);
            if (delErr) throw new ApiError(delErr.message, 500);
        }

        // ── 2. Update lines that are still present ────────────────────────────
        for (const l of submitted) {
            if (typeof l.id !== 'number' || !existing.has(l.id)) continue;
            const counters = existing.get(l.id) ?? { shipped: 0, invoiced: 0 };
            if (l.ordered_qty < counters.shipped) {
                throw new ApiError(
                    `Ordered quantity for an item cannot be less than the quantity already shipped (${counters.shipped}).`,
                    400,
                    'QTY_BELOW_SHIPPED',
                );
            }
            if (l.ordered_qty < counters.invoiced) {
                throw new ApiError(
                    `Ordered quantity for an item cannot be less than the quantity already invoiced (${counters.invoiced}).`,
                    400,
                    'QTY_BELOW_INVOICED',
                );
            }
            const { error } = await this.db
                .from(LINE_TABLE)
                .update({
                    item_id: l.item_id,
                    item_class: classes.get(l.item_id) ?? 'stock',
                    item_uom_id: l.item_uom_id ?? null,
                    description: l.description ?? null,
                    uom: l.uom ?? null,
                    ordered_qty: l.ordered_qty,
                    unit_price: l.unit_price,
                    discount: l.discount ?? 0,
                    tax: l.tax ?? 0,
                    line_total: lineTotal({
                        ordered_qty: l.ordered_qty,
                        unit_price: l.unit_price,
                        discount: l.discount ?? 0,
                        tax: l.tax ?? 0,
                    }),
                })
                .eq('id', l.id)
                .eq('order_id', orderId)
                .eq('company_id', companyId);
            if (error) throw new ApiError(error.message, 500);
        }

        // ── 3. Insert newly added lines ───────────────────────────────────────
        const newLines = submitted.filter((l) => typeof l.id !== 'number');
        if (newLines.length) {
            await this.insertLines(companyId, orderId, newLines, classes);
        }
    }

    async deleteOne(ctx: RequestContext, id: number): Promise<void> {
        const existing = await this.findOne(ctx, id);
        if (!existing) throw new NotFoundError('Sales order not found');
        if (existing.status !== 'open') {
            throw new ApiError(
                `Cannot delete a ${existing.status} order`,
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

    async cancelOne(ctx: RequestContext, id: number): Promise<SalesOrder> {
        const existing = await this.findOne(ctx, id);
        if (!existing) throw new NotFoundError('Sales order not found');
        if (existing.status === 'closed' || existing.status === 'cancelled') {
            throw new ApiError(
                `Cannot cancel a ${existing.status} order`,
                400,
                'INVALID_STATUS',
            );
        }
        // Block cancellation when stock has already moved out.
        const { count } = await this.db
            .from(SHIPMENT_TABLE)
            .select('id', { count: 'exact', head: true })
            .eq('company_id', Number(ctx.companyId))
            .eq('sales_order_id', id)
            .eq('status', 'POSTED');
        if ((count ?? 0) > 0) {
            throw new ApiError(
                'Cannot cancel: order has posted shipments',
                400,
                'HAS_POSTED_SHIPMENTS',
            );
        }
        return this.setStatus(ctx, id, 'cancelled');
    }

    async closeOne(ctx: RequestContext, id: number): Promise<SalesOrder> {
        const existing = await this.findOne(ctx, id);
        if (!existing) throw new NotFoundError('Sales order not found');
        if (existing.status === 'closed' || existing.status === 'cancelled') {
            throw new ApiError(
                `Cannot close a ${existing.status} order`,
                400,
                'INVALID_STATUS',
            );
        }
        return this.setStatus(ctx, id, 'closed');
    }

    /** Add shipped quantities to order lines (called when a shipment is POSTED). */
    async incrementShipped(
        ctx: RequestContext,
        entries: { sales_order_item_id: number; qty: number }[],
    ): Promise<void> {
        const companyId = Number(ctx.companyId);
        for (const e of entries) {
            const { data: line, error } = await this.db
                .from(LINE_TABLE)
                .select('id, shipped_qty')
                .eq('id', e.sales_order_item_id)
                .eq('company_id', companyId)
                .maybeSingle();
            if (error) throw new ApiError(error.message, 500);
            if (!line) continue;
            const { error: upErr } = await this.db
                .from(LINE_TABLE)
                .update({ shipped_qty: Number(line.shipped_qty) + e.qty })
                .eq('id', e.sales_order_item_id)
                .eq('company_id', companyId);
            if (upErr) throw new ApiError(upErr.message, 500);
        }
    }

    /**
     * Re-derive `shipped_qty` on every order line from the shipments that
     * actually moved stock (a shipment counts once it is POSTED and keeps
     * counting while it is being invoiced). Because it recomputes rather than
     * accumulates, it is safe to call after a partially-applied increment or
     * after a posted shipment has been reversed — the lines always end up
     * agreeing with the shipment table.
     */
    async recomputeShippedQty(
        ctx: RequestContext,
        orderId: number,
    ): Promise<void> {
        const companyId = Number(ctx.companyId);
        const SHIPPED_STATES = ['POSTED', 'PARTIALLY_INVOICED', 'INVOICED'];

        const { data: lines, error: lineErr } = await this.db
            .from(LINE_TABLE)
            .select('id')
            .eq('order_id', orderId)
            .eq('company_id', companyId);
        if (lineErr) throw new ApiError(lineErr.message, 500);

        const { data: shipped, error: shipErr } = await this.db
            .from('sales_shipment_items')
            .select(
                'sales_order_item_id, shipment_qty, shipment:sales_shipment!inner(id, sales_order_id, status)',
            )
            .eq('company_id', companyId)
            .eq('shipment.sales_order_id', orderId)
            .in('shipment.status', SHIPPED_STATES);
        if (shipErr) throw new ApiError(shipErr.message, 500);

        const byLine = new Map<number, number>();
        for (const row of shipped ?? []) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const r = row as any;
            if (r.sales_order_item_id == null) continue;
            byLine.set(
                r.sales_order_item_id,
                (byLine.get(r.sales_order_item_id) ?? 0) +
                    Number(r.shipment_qty),
            );
        }

        for (const line of lines ?? []) {
            const { error } = await this.db
                .from(LINE_TABLE)
                .update({ shipped_qty: byLine.get(line.id) ?? 0 })
                .eq('id', line.id)
                .eq('company_id', companyId);
            if (error) throw new ApiError(error.message, 500);
        }
    }

    /**
     * Add invoiced quantities to direct-invoice order lines (called when an
     * order-sourced invoice is created/posted). Mirrors incrementShipped.
     */
    async incrementInvoiced(
        ctx: RequestContext,
        entries: { sales_order_item_id: number; qty: number }[],
    ): Promise<void> {
        const companyId = Number(ctx.companyId);
        for (const e of entries) {
            const { data: line, error } = await this.db
                .from(LINE_TABLE)
                .select('id, invoiced_qty')
                .eq('id', e.sales_order_item_id)
                .eq('company_id', companyId)
                .maybeSingle();
            if (error) throw new ApiError(error.message, 500);
            if (!line) continue;
            const { error: upErr } = await this.db
                .from(LINE_TABLE)
                .update({
                    invoiced_qty: Number(line.invoiced_qty ?? 0) + e.qty,
                })
                .eq('id', e.sales_order_item_id)
                .eq('company_id', companyId);
            if (upErr) throw new ApiError(upErr.message, 500);
        }
    }

    /**
     * Re-derive `invoiced_qty` from the invoice lines that reference order
     * lines directly (shipment-sourced invoice lines carry shipment_item_id
     * and fulfill through shipped_qty instead). Cancelled invoices do not
     * count. Recompute-not-accumulate: safe after cancels and partial writes.
     */
    async recomputeInvoicedQty(
        ctx: RequestContext,
        orderId: number,
    ): Promise<void> {
        const companyId = Number(ctx.companyId);

        const { data: lines, error: lineErr } = await this.db
            .from(LINE_TABLE)
            .select('id')
            .eq('order_id', orderId)
            .eq('company_id', companyId);
        if (lineErr) throw new ApiError(lineErr.message, 500);
        const lineIds = (lines ?? []).map((l) => l.id as number);
        if (lineIds.length === 0) return;

        const { data: invoiced, error: invErr } = await this.db
            .from('sales_invoice_items')
            .select(
                'sales_order_item_id, quantity, invoice:sales_invoice!inner(id, status)',
            )
            .eq('company_id', companyId)
            .in('sales_order_item_id', lineIds)
            .is('shipment_item_id', null)
            .neq('invoice.status', 'CANCELLED');
        if (invErr) throw new ApiError(invErr.message, 500);

        const byLine = new Map<number, number>();
        for (const row of invoiced ?? []) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const r = row as any;
            if (r.sales_order_item_id == null) continue;
            byLine.set(
                r.sales_order_item_id,
                (byLine.get(r.sales_order_item_id) ?? 0) + Number(r.quantity),
            );
        }

        for (const id of lineIds) {
            const { error } = await this.db
                .from(LINE_TABLE)
                .update({ invoiced_qty: byLine.get(id) ?? 0 })
                .eq('id', id)
                .eq('company_id', companyId);
            if (error) throw new ApiError(error.message, 500);
        }
    }

    /** Recompute progress status from current line quantities. */
    async recomputeStatus(ctx: RequestContext, orderId: number): Promise<void> {
        const companyId = Number(ctx.companyId);
        const { data: header } = await this.db
            .from(HEADER_TABLE)
            .select('status')
            .eq('id', orderId)
            .eq('company_id', companyId)
            .maybeSingle();
        if (!header || header.status === 'cancelled') return;

        const { data: lines, error } = await this.db
            .from(LINE_TABLE)
            .select('ordered_qty, shipped_qty, invoiced_qty, item_class')
            .eq('order_id', orderId)
            .eq('company_id', companyId);
        if (error) throw new ApiError(error.message, 500);

        const status = deriveOrderStatus(
            (lines ?? []).map((l) => ({
                ordered_qty: Number(l.ordered_qty),
                shipped_qty: Number(l.shipped_qty),
                invoiced_qty: Number(l.invoiced_qty ?? 0),
                item_class: (l.item_class as string) ?? 'stock',
            })),
        );
        await this.db
            .from(HEADER_TABLE)
            .update(this.stampUpdate(ctx, { status }))
            .eq('id', orderId)
            .eq('company_id', companyId);
    }

    // ── internals ───────────────────────────────────────────────────────────

    private async insertLines(
        companyId: number,
        orderId: number,
        items: CreateSalesOrderInput['items'],
        classes?: Map<number, string>,
    ): Promise<void> {
        const classMap =
            classes ??
            (await this.classesFor(
                companyId,
                items.map((l) => l.item_id),
            ));
        const rows = items.map((l) => ({
            order_id: orderId,
            company_id: companyId,
            item_id: l.item_id,
            item_class: classMap.get(l.item_id) ?? 'stock',
            item_uom_id: l.item_uom_id ?? null,
            description: l.description ?? null,
            uom: l.uom ?? null,
            ordered_qty: l.ordered_qty,
            shipped_qty: 0,
            invoiced_qty: 0,
            unit_price: l.unit_price,
            discount: l.discount ?? 0,
            tax: l.tax ?? 0,
            line_total: lineTotal({
                ordered_qty: l.ordered_qty,
                unit_price: l.unit_price,
                discount: l.discount ?? 0,
                tax: l.tax ?? 0,
            }),
        }));
        const { error } = await this.db.from(LINE_TABLE).insert(rows);
        if (error) throw new ApiError(error.message, 500);
    }

    private async setStatus(
        ctx: RequestContext,
        id: number,
        status: SalesOrderStatus,
    ): Promise<SalesOrder> {
        const { error } = await this.db
            .from(HEADER_TABLE)
            .update(this.stampUpdate(ctx, { status }))
            .eq('id', id)
            .eq('company_id', Number(ctx.companyId));
        if (error) throw new ApiError(error.message, 500);
        return (await this.findOne(ctx, id))!;
    }
}
