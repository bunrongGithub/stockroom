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
import { ItemUomRepository } from '@/service/apps/inventory/repo/item-uom';
import { toBaseQty, uomContextOf } from '@/service/core/uom-conversion';
import { ApiError, NotFoundError } from '@/service/core/api-response';
import { behaviorOf } from '@/service/core/item-behavior';
import { lineTotal, documentTotals } from '../pricing';
import { SalesShipmentRepository } from './shipment';
import { SalesOrderRepository } from './order';
import type {
    CreateSalesInvoiceInput,
    UpdateSalesInvoiceInput,
} from '@/service/schema/sale-invoice.schema';
import type {
    SalesInvoice,
    SalesInvoiceItem,
    SalesInvoiceStatus,
    SalesInvoiceActions,
} from '@/types/sales/order-management';
import type {
    OutstandingInvoice,
    InvoicePaymentRef,
} from '@/types/sales/payment';
import { deriveInvoicePayment } from '../payment-summary';

const HEADER_TABLE = 'sales_invoice' as const;
const LINE_TABLE = 'sales_invoice_items' as const;

const SELECT_LIST =
    '*, shipment:sales_shipment(id, shipment_no), sales_order:sales_order(id, order_no)';
const SELECT_DETAIL =
    '*, shipment:sales_shipment(id, shipment_no), sales_order:sales_order(id, order_no), items:sales_invoice_items(*, item:inventory_item(id, name, sku, track_serial, item_class), item_uom:inventory_item_uom(id, uom:inventory_uom(id, name, display_name)))';

/** Draft = editable/deletable; Posted = official/cancellable; Cancelled = terminal. */
export function computeInvoiceActions(
    status: SalesInvoiceStatus,
): SalesInvoiceActions {
    return {
        can_update: status === 'DRAFT',
        can_post: status === 'DRAFT',
        can_delete: status === 'DRAFT',
        can_cancel: status === 'POSTED',
    };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapInvoiceItem(r: any): SalesInvoiceItem {
    return {
    id: r.id,
    item_id: r.item_id,
    sales_order_item_id: r.sales_order_item_id ?? null,
    shipment_item_id: r.shipment_item_id ?? null,
    product_name: r.item?.name ?? r.description ?? `#${r.item_id}`,
    sku: r.item?.sku ?? null,
    item_class: r.item?.item_class ?? 'stock',
    track_serial: r.item?.track_serial ?? false,
    description: r.description ?? '',
    // Prefer the snapshotted text: it is what the document was issued with and
    // must not change if the UOM is later renamed.
    uom: r.uom ?? r.item_uom?.uom?.name ?? '',
    item_uom_id: r.item_uom_id ?? null,
    conversion_factor: Number(r.conversion_factor ?? 1),
    base_quantity: toBaseQty(
        Number(r.quantity),
        uomContextOf(r, r.item_uom),
    ),
    quantity: Number(r.quantity),
    unit_price: Number(r.unit_price),
    discount: Number(r.discount),
    tax: Number(r.tax),
    line_total: Number(r.line_total),
    reference_no: r.reference_no ?? null,
};
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapInvoice(r: any): SalesInvoice {
    // Payment state derived through the single source of truth so
    // amount_paid / outstanding / payment_status can never drift apart.
    const pay = deriveInvoicePayment(
        Number(r.grand_total),
        Number(r.amount_paid ?? 0),
    );
    return {
        id: r.id,
        invoice_no: r.invoice_no,
        reference_no: r.reference_no ?? null,
        shipment_id: r.shipment_id,
        shipment_no: r.shipment?.shipment_no ?? '',
        sales_order_id: r.sales_order_id ?? null,
        sales_order_no: r.sales_order?.order_no ?? '',
        customer_name: r.customer_name ?? null,
        customer_phone: r.customer_phone ?? null,
        customer_address: r.customer_address ?? null,
        invoice_date: r.invoice_date,
        currency: r.currency,
        exchange_rate: Number(r.exchange_rate ?? 1),
        status: r.status,
        subtotal: Number(r.subtotal),
        discount_total: Number(r.discount_total),
        tax_total: Number(r.tax_total),
        grand_total: Number(r.grand_total),
        amount_paid: pay.amount_paid,
        outstanding: pay.outstanding,
        payment_status: pay.payment_status,
        total_quantity: (r.items ?? []).reduce(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (sum: number, it: any) => sum + Number(it.quantity ?? 0),
            0,
        ),
        remarks: r.remarks ?? null,
        created_at: r.created_at,
        updated_at: r.updated_at,
        items: (r.items ?? []).map(mapInvoiceItem),
        actions: computeInvoiceActions(r.status),
    };
}

type InvoiceLineDraft = {
    id?: number;
    item_id: number;
    sales_order_item_id: number | null;
    shipment_item_id: number | null;
    description: string | null;
    uom: string | null;
    /** The unit the quantity is expressed in, carried from the source line. */
    item_uom_id?: number | null;
    /** base_qty = quantity × conversion_factor, snapshotted at save time. */
    conversion_factor?: number;
    quantity: number;
    unit_price: number;
    discount: number;
    tax: number;
};

// ─── Repository ─────────────────────────────────────────────────────────────

export class SalesInvoiceRepository extends BaseRepository {
    private static instance: SalesInvoiceRepository;

    /**
     * Query Framework registry. No `selectableFields`: list rows run through
     * mapInvoice(), which needs complete rows.
     */
    protected readonly queryConfig: QueryConfig = {
        table: HEADER_TABLE,
        searchable: ['invoice_no', 'reference_no', 'customer_name'],
        sortable: [
            'invoice_no',
            'customer_name',
            'invoice_date',
            'status',
            'grand_total',
            'created_at',
        ],
        filterable: {
            status: { type: 'enum', values: ['DRAFT', 'POSTED', 'CANCELLED'] },
            invoice_date: { type: 'date' },
            created_at: { type: 'date' },
            grand_total: { type: 'number' },
            sales_order_id: { type: 'foreign-key' },
            shipment_id: { type: 'foreign-key' },
        },
        relations: {
            shipment: {
                table: 'sales_shipment',
                columns: ['id', 'shipment_no'],
                always: true,
            },
            sales_order: {
                table: 'sales_order',
                columns: ['id', 'order_no'],
                always: true,
            },
        },
        defaultSort: [{ field: 'id', direction: 'desc' }],
    };

    /** Standardized list path (Query Framework). */
    async findAllV2(
        ctx: RequestContext,
        query: QueryObject,
    ): Promise<PaginatedResult<SalesInvoice>> {
        return this.findAllQuery<SalesInvoice>(ctx, query, {
            enrichAudit: true,
            map: mapInvoice,
        });
    }

    static getInstance(): SalesInvoiceRepository {
        if (!SalesInvoiceRepository.instance) {
            SalesInvoiceRepository.instance = new SalesInvoiceRepository();
        }
        return SalesInvoiceRepository.instance;
    }

    async findAll(
        ctx: RequestContext,
        params: PaginationParams,
    ): Promise<PaginatedResult<SalesInvoice>> {
        const isSuperUser = await this.isSupperUser(ctx);
        let query = this.applyFilter(
            this.db.from(HEADER_TABLE).select(SELECT_LIST, { count: 'exact' }),
            ctx,
            isSuperUser,
        ).order('id', { ascending: false });
        // Search matches the system number OR the user reference number.
        if (params.search) {
            query = query.or(
                `invoice_no.ilike.%${params.search}%,reference_no.ilike.%${params.search}%`,
            );
        }
        const result = await this.paginate<Record<string, unknown>>(query, {
            ...params,
            search: undefined,
            searchColumn: undefined,
        });
        return { ...result, data: result.data.map(mapInvoice) };
    }

    async findOne(
        ctx: RequestContext,
        id: number,
    ): Promise<(SalesInvoice & Partial<AuditMeta>) | null> {
        const isSuperUser = await this.isSupperUser(ctx);
        const { data, error } = await this.applyFilter(
            this.db.from(HEADER_TABLE).select(SELECT_DETAIL).eq('id', id),
            ctx,
            isSuperUser,
        ).maybeSingle();
        if (error) throw new ApiError(error.message, 500);
        if (!data) return null;

        const invoice = mapInvoice(data);

        // Enrich lines with serial numbers from inventory_serial (the source of
        // truth — sold serials reference the shipment line). READ-ONLY: printing
        // an invoice never touches inventory or serial state.
        const shipItemIds = invoice.items
            .map((i) => i.shipment_item_id)
            .filter((v): v is number => v != null);
        if (shipItemIds.length) {
            const { data: serialRows } = await this.db
                .from('inventory_serial')
                .select('serial_number, sale_item_id')
                .eq('company_id', Number(ctx.companyId))
                .in('sale_item_id', shipItemIds)
                .order('serial_number', { ascending: true });
            const byShipItem = new Map<number, string[]>();
            for (const row of serialRows ?? []) {
                if (row.sale_item_id == null) continue;
                const list = byShipItem.get(row.sale_item_id) ?? [];
                list.push(row.serial_number);
                byShipItem.set(row.sale_item_id, list);
            }
            for (const item of invoice.items) {
                item.serial_numbers =
                    item.shipment_item_id != null
                        ? (byShipItem.get(item.shipment_item_id) ?? [])
                        : [];
            }
        }

        return this.enrichAuditOne({
            ...invoice,
            created_by: (data as { created_by?: string | null }).created_by ?? null,
            updated_by: (data as { updated_by?: string | null }).updated_by ?? null,
        });
    }

    /** All invoices raised against a shipment (for the shipment's Invoices tab). */
    async findByShipment(
        ctx: RequestContext,
        shipmentId: number,
    ): Promise<SalesInvoice[]> {
        const isSuperUser = await this.isSupperUser(ctx);
        const { data, error } = await this.applyFilter(
            this.db
                .from(HEADER_TABLE)
                .select(SELECT_DETAIL)
                .eq('shipment_id', shipmentId),
            ctx,
            isSuperUser,
        ).order('id', { ascending: true });
        if (error) throw new ApiError(error.message, 500);
        return (data ?? []).map(mapInvoice);
    }

    /**
     * Create a DRAFT invoice from a POSTED / PARTIALLY_INVOICED shipment.
     * Supports PARTIAL and MULTIPLE invoices: each line defaults to its remaining
     * (shipped − already invoiced) and is validated `qty ≤ remaining`. Line pricing
     * comes from the source ORDER line (shipments carry no pricing). Never touches
     * inventory. Recomputes the shipment status from invoiced-vs-shipped quantity.
     *
     * When the shipment's order also carries direct-invoice lines (non-stock /
     * service — item-behavior), their un-invoiced remainder is AUTO-INCLUDED as
     * order-sourced lines (shipment_item_id null) so a mixed order yields one
     * combined invoice. The client can exclude one by sending it with qty 0.
     */
    async createFromShipment(
        ctx: RequestContext,
        input: CreateSalesInvoiceInput,
    ): Promise<SalesInvoice> {
        const companyId = Number(ctx.companyId);
        const shipmentRepo = SalesShipmentRepository.getInstance();
        const shipmentId = input.shipment_id;
        if (!shipmentId) {
            throw new ApiError('shipment_id is required', 400);
        }

        const shipment = await shipmentRepo.findOne(ctx, shipmentId);
        if (!shipment) throw new NotFoundError('Shipment not found');
        if (!shipment.actions?.can_invoice) {
            throw new ApiError(
                'Only a shipped shipment with remaining quantity can be invoiced.',
                400,
                'INVALID_STATUS',
            );
        }

        const order = shipment.sales_order_id
            ? await SalesOrderRepository.getInstance().findOne(
                  ctx,
                  shipment.sales_order_id,
              )
            : null;
        const orderLineById = new Map(
            (order?.items ?? []).map((o) => [o.id, o]),
        );

        // Already-invoiced quantity per shipment line (all active invoices).
        const invoiced = await shipmentRepo.getInvoicedQtyByShipmentItem(
            ctx,
            shipmentId,
        );
        const edits = input.items ?? [];
        const editByShipItem = new Map(
            edits
                .filter((i) => i.shipment_item_id != null)
                .map((i) => [i.shipment_item_id as number, i]),
        );
        const editByOrderItem = new Map(
            edits
                .filter(
                    (i) =>
                        i.shipment_item_id == null &&
                        i.sales_order_item_id != null,
                )
                .map((i) => [i.sales_order_item_id as number, i]),
        );

        // One invoice line per shipment line that still has remaining quantity.
        const lines: InvoiceLineDraft[] = [];
        for (const s of shipment.items) {
            const remaining =
                Number(s.shipment_qty) - (invoiced.get(s.id) ?? 0);
            if (remaining <= 0) continue;

            const edit = editByShipItem.get(s.id);
            const quantity = edit ? Number(edit.quantity) : remaining;
            if (quantity <= 0) continue;
            if (quantity > remaining) {
                throw new ApiError(
                    `Cannot invoice ${quantity} of ${s.product_name}: only ${remaining} remaining.`,
                    400,
                    'EXCEEDS_REMAINING',
                );
            }
            const ol = orderLineById.get(s.sales_order_item_id);
            lines.push({
                item_id: s.item_id,
                sales_order_item_id: s.sales_order_item_id,
                shipment_item_id: s.id,
                description: ol?.description || s.product_name,
                uom: s.uom,
                // An invoice bills what was shipped, so it inherits the
                // shipment line's unit rather than re-deriving one.
                item_uom_id: s.item_uom_id ?? null,
                quantity,
                unit_price: edit?.unit_price ?? ol?.unit_price ?? 0,
                discount: edit?.discount ?? ol?.discount ?? 0,
                tax: edit?.tax ?? ol?.tax ?? 0,
            });
        }

        // Combined invoicing: append the order's un-invoiced direct lines.
        const directEntries: { sales_order_item_id: number; qty: number }[] =
            [];
        for (const ol of order?.items ?? []) {
            if (behaviorOf(ol.item_class).requiresShipment) continue;
            const remaining = ol.ordered_qty - ol.invoiced_qty;
            if (remaining <= 0) continue;

            const edit = editByOrderItem.get(ol.id);
            const quantity = edit ? Number(edit.quantity) : remaining;
            if (quantity <= 0) continue; // explicit exclude
            if (quantity > remaining) {
                throw new ApiError(
                    `Cannot invoice ${quantity} of ${ol.product_name}: only ${remaining} remaining.`,
                    400,
                    'EXCEEDS_REMAINING',
                );
            }
            lines.push({
                item_id: ol.item_id,
                sales_order_item_id: ol.id,
                shipment_item_id: null,
                description: ol.description || ol.product_name,
                uom: ol.uom,
                // Direct lines never ship, so they bill in the order's unit.
                item_uom_id: ol.item_uom_id ?? null,
                quantity,
                unit_price: edit?.unit_price ?? ol.unit_price,
                discount: edit?.discount ?? ol.discount,
                tax: edit?.tax ?? ol.tax,
            });
            directEntries.push({ sales_order_item_id: ol.id, qty: quantity });
        }

        if (!lines.length) {
            throw new ApiError(
                'Nothing left to invoice on this shipment.',
                400,
                'NOTHING_TO_INVOICE',
            );
        }

        const header = await this.insertInvoice(ctx, {
            shipment_id: shipmentId,
            sales_order_id: shipment.sales_order_id ?? null,
            // The partner link follows the order, so an invoice is traceable to
            // the master even though its name/phone stay a snapshot.
            customer_id: input.customer_id ?? order?.customer_id ?? null,
            customer_name: input.customer_name ?? shipment.customer_name,
            customer_phone: input.customer_phone ?? shipment.customer_phone,
            customer_address:
                input.customer_address ?? shipment.delivery_address,
            currency: input.currency ?? order?.currency ?? 'USD',
            input,
            lines,
        });

        await shipmentRepo.recomputeInvoiceStatus(ctx, shipmentId);
        if (directEntries.length && shipment.sales_order_id) {
            const orders = SalesOrderRepository.getInstance();
            await orders.incrementInvoiced(ctx, directEntries);
            await orders.recomputeStatus(ctx, shipment.sales_order_id);
        }

        return (await this.findOne(ctx, header.id))!;
    }

    /**
     * Create a DRAFT invoice straight from a sales order — for its
     * direct-invoice (non-stock / service) lines only. Stock lines fulfill
     * through shipments and are rejected here. This is how an order with no
     * shippable lines gets invoiced at all (it never has a shipment).
     */
    async createFromOrder(
        ctx: RequestContext,
        input: CreateSalesInvoiceInput,
    ): Promise<SalesInvoice> {
        const orderId = input.sales_order_id;
        if (!orderId) {
            throw new ApiError('sales_order_id is required', 400);
        }
        const orders = SalesOrderRepository.getInstance();
        const order = await orders.findOne(ctx, orderId);
        if (!order) throw new NotFoundError('Sales order not found');
        if (order.status === 'cancelled') {
            throw new ApiError(
                'Cannot invoice a cancelled order',
                400,
                'INVALID_STATUS',
            );
        }

        const edits = new Map(
            (input.items ?? [])
                .filter((i) => i.sales_order_item_id != null)
                .map((i) => [i.sales_order_item_id as number, i]),
        );

        const lines: InvoiceLineDraft[] = [];
        const directEntries: { sales_order_item_id: number; qty: number }[] =
            [];
        for (const ol of order.items) {
            if (behaviorOf(ol.item_class).requiresShipment) {
                // Stock lines are invoiced via their shipment; a client that
                // explicitly asks for one gets a clear error, silent skip
                // otherwise.
                if (edits.has(ol.id)) {
                    throw new ApiError(
                        `${ol.product_name} is a stock item — invoice it from its shipment`,
                        422,
                        'REQUIRES_SHIPMENT',
                    );
                }
                continue;
            }
            const remaining = ol.ordered_qty - ol.invoiced_qty;
            if (remaining <= 0) continue;

            const edit = edits.get(ol.id);
            const quantity = edit ? Number(edit.quantity) : remaining;
            if (quantity <= 0) continue;
            if (quantity > remaining) {
                throw new ApiError(
                    `Cannot invoice ${quantity} of ${ol.product_name}: only ${remaining} remaining.`,
                    400,
                    'EXCEEDS_REMAINING',
                );
            }
            lines.push({
                item_id: ol.item_id,
                sales_order_item_id: ol.id,
                shipment_item_id: null,
                description: ol.description || ol.product_name,
                uom: ol.uom,
                // Direct lines never ship, so they bill in the order's unit.
                item_uom_id: ol.item_uom_id ?? null,
                quantity,
                unit_price: edit?.unit_price ?? ol.unit_price,
                discount: edit?.discount ?? ol.discount,
                tax: edit?.tax ?? ol.tax,
            });
            directEntries.push({ sales_order_item_id: ol.id, qty: quantity });
        }

        if (!lines.length) {
            throw new ApiError(
                'Nothing left to invoice on this order.',
                400,
                'NOTHING_TO_INVOICE',
            );
        }

        const header = await this.insertInvoice(ctx, {
            shipment_id: null,
            sales_order_id: orderId,
            customer_id: input.customer_id ?? order.customer_id ?? null,
            customer_name: input.customer_name ?? order.customer_name,
            customer_phone: input.customer_phone ?? order.customer_phone,
            customer_address: input.customer_address ?? null,
            currency: input.currency ?? order.currency,
            input,
            lines,
        });

        await orders.incrementInvoiced(ctx, directEntries);
        await orders.recomputeStatus(ctx, orderId);

        return (await this.findOne(ctx, header.id))!;
    }

    /** Shared header+lines insert for both invoice factories. */
    private async insertInvoice(
        ctx: RequestContext,
        args: {
            shipment_id: number | null;
            sales_order_id: number | null;
            customer_id: number | null;
            customer_name: string | null;
            customer_phone: string | null;
            customer_address: string | null;
            currency: string;
            input: CreateSalesInvoiceInput;
            lines: InvoiceLineDraft[];
        },
    ): Promise<{ id: number }> {
        const companyId = Number(ctx.companyId);
        const totals = documentTotals(
            args.lines.map((l) => ({
                quantity: l.quantity,
                unit_price: l.unit_price,
                discount: l.discount,
                tax: l.tax,
            })),
        );

        const { data: header, error } = await this.db
            .from(HEADER_TABLE)
            .insert(
                this.stampCreate(ctx, {
                    company_id: companyId,
                    user_id: ctx.userId,
                    invoice_no: await getNextDocumentNumber(ctx, 'sales_invoice'),
                    reference_no: args.input.reference_no ?? null,
                    shipment_id: args.shipment_id,
                    sales_order_id: args.sales_order_id,
                    customer_id: args.customer_id ?? null,
                    customer_name: args.customer_name,
                    customer_phone: args.customer_phone,
                    customer_address: args.customer_address,
                    invoice_date: args.input.invoice_date,
                    currency: args.currency,
                    exchange_rate: args.input.exchange_rate ?? 1,
                    status: 'DRAFT',
                    ...totals,
                    remarks: args.input.remarks ?? null,
                }),
            )
            .select()
            .single();
        if (error) throw new ApiError(error.message, 500);

        try {
            await this.insertLines(ctx, companyId, header.id, args.lines);
        } catch (err) {
            await this.db.from(HEADER_TABLE).delete().eq('id', header.id);
            throw err;
        }
        return header;
    }

    async updateOne(
        ctx: RequestContext,
        id: number,
        input: UpdateSalesInvoiceInput,
    ): Promise<SalesInvoice> {
        const companyId = Number(ctx.companyId);
        const existing = await this.findOne(ctx, id);
        if (!existing) throw new NotFoundError('Invoice not found');
        if (existing.status !== 'DRAFT') {
            throw new ApiError(
                'Only DRAFT invoices can be edited',
                400,
                'INVALID_STATUS',
            );
        }

        // Validate edited quantities against remaining (shipped − invoiced by
        // OTHER invoices, so this invoice's own current lines don't count).
        if (input.items && existing.shipment_id) {
            const shipmentRepo = SalesShipmentRepository.getInstance();
            const shipment = await shipmentRepo.findOne(
                ctx,
                existing.shipment_id,
            );
            const shippedById = new Map(
                (shipment?.items ?? []).map((s) => [
                    s.id,
                    Number(s.shipment_qty),
                ]),
            );
            const invoicedByOthers =
                await shipmentRepo.getInvoicedQtyByShipmentItem(
                    ctx,
                    existing.shipment_id,
                    id,
                );
            for (const l of input.items) {
                if (l.shipment_item_id == null) continue;
                const remaining =
                    (shippedById.get(l.shipment_item_id) ?? 0) -
                    (invoicedByOthers.get(l.shipment_item_id) ?? 0);
                if (Number(l.quantity) > remaining) {
                    throw new ApiError(
                        `Invoice quantity for a line exceeds remaining (${remaining}).`,
                        400,
                        'EXCEEDS_REMAINING',
                    );
                }
            }
        }

        // Direct (order-sourced) lines: remaining = ordered − invoiced by
        // other invoices. The order-line counter includes THIS invoice, so
        // add back this invoice's own current quantity per line.
        if (input.items && existing.sales_order_id) {
            const order = await SalesOrderRepository.getInstance().findOne(
                ctx,
                existing.sales_order_id,
            );
            const orderLineById = new Map(
                (order?.items ?? []).map((o) => [o.id, o]),
            );
            const ownByOrderItem = new Map<number, number>();
            for (const l of existing.items) {
                if (l.shipment_item_id != null) continue;
                if (l.sales_order_item_id == null) continue;
                ownByOrderItem.set(
                    l.sales_order_item_id,
                    (ownByOrderItem.get(l.sales_order_item_id) ?? 0) +
                        Number(l.quantity),
                );
            }
            for (const l of input.items) {
                if (l.shipment_item_id != null) continue;
                if (l.sales_order_item_id == null) continue;
                const ol = orderLineById.get(l.sales_order_item_id);
                if (!ol) continue;
                const remaining =
                    ol.ordered_qty -
                    ol.invoiced_qty +
                    (ownByOrderItem.get(l.sales_order_item_id) ?? 0);
                if (Number(l.quantity) > remaining) {
                    throw new ApiError(
                        `Invoice quantity for ${ol.product_name} exceeds remaining (${remaining}).`,
                        400,
                        'EXCEEDS_REMAINING',
                    );
                }
            }
        }

        const lines: InvoiceLineDraft[] | null = input.items
            ? input.items.map((i) => ({
                  item_id: i.item_id,
                  sales_order_item_id: i.sales_order_item_id ?? null,
                  shipment_item_id: i.shipment_item_id ?? null,
                  description: i.description ?? null,
                  uom: i.uom ?? null,
                  quantity: i.quantity,
                  unit_price: i.unit_price,
                  discount: i.discount ?? 0,
                  tax: i.tax ?? 0,
              }))
            : null;

        const totals = lines
            ? documentTotals(
                  lines.map((l) => ({
                      quantity: l.quantity,
                      unit_price: l.unit_price,
                      discount: l.discount,
                      tax: l.tax,
                  })),
              )
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
                    reference_no: input.reference_no ?? existing.reference_no,
                    customer_name:
                        input.customer_name ?? existing.customer_name,
                    customer_phone:
                        input.customer_phone ?? existing.customer_phone,
                    customer_address:
                        input.customer_address ?? existing.customer_address,
                    invoice_date: input.invoice_date,
                    currency: input.currency ?? existing.currency,
                    exchange_rate:
                        input.exchange_rate ?? existing.exchange_rate,
                    remarks: input.remarks ?? null,
                    ...totals,
                }),
            )
            .eq('id', id)
            .eq('company_id', companyId);
        if (error) throw new ApiError(error.message, 500);

        if (lines) {
            // Invoice items have no external referrers → a checked full replace
            // is safe and idempotent.
            const { error: delErr } = await this.db
                .from(LINE_TABLE)
                .delete()
                .eq('invoice_id', id)
                .eq('company_id', companyId);
            if (delErr) throw new ApiError(delErr.message, 500);
            await this.insertLines(ctx, companyId, id, lines);
            await this.syncSourceDocs(
                ctx,
                existing.shipment_id,
                existing.sales_order_id,
            );
        }

        return (await this.findOne(ctx, id))!;
    }

    /**
     * Re-derive both source documents' state after this invoice changed:
     * the shipment's POSTED/PARTIALLY_INVOICED/INVOICED status and the
     * order's direct-line invoiced_qty counters + progress status.
     */
    private async syncSourceDocs(
        ctx: RequestContext,
        shipmentId: number | null,
        orderId: number | null,
    ): Promise<void> {
        if (shipmentId) {
            await SalesShipmentRepository.getInstance().recomputeInvoiceStatus(
                ctx,
                shipmentId,
            );
        }
        if (orderId) {
            const orders = SalesOrderRepository.getInstance();
            await orders.recomputeInvoicedQty(ctx, orderId);
            await orders.recomputeStatus(ctx, orderId);
        }
    }

    async deleteOne(ctx: RequestContext, id: number): Promise<void> {
        const existing = await this.findOne(ctx, id);
        if (!existing) throw new NotFoundError('Invoice not found');
        if (existing.status !== 'DRAFT') {
            throw new ApiError(
                'Only DRAFT invoices can be deleted',
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

        await this.syncSourceDocs(
            ctx,
            existing.shipment_id,
            existing.sales_order_id,
        );
    }

    /**
     * Remove a CANCELLED invoice. This is a COMPENSATION primitive, not an
     * accounting operation: it exists so a sale that failed on its way to being
     * paid (Cash Sale) leaves nothing behind — no invoice, and therefore no FK
     * holding its order and shipment in place. A cancelled invoice that a human
     * cancelled deliberately is never routed here; only the orchestrator that
     * created it moments earlier calls it.
     */
    async deleteCancelled(ctx: RequestContext, id: number): Promise<void> {
        const existing = await this.findOne(ctx, id);
        if (!existing) return;
        if (existing.status !== 'CANCELLED') {
            throw new ApiError(
                'Only a CANCELLED invoice can be removed',
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

        await this.syncSourceDocs(
            ctx,
            existing.shipment_id,
            existing.sales_order_id,
        );
    }

    async postOne(ctx: RequestContext, id: number): Promise<SalesInvoice> {
        const existing = await this.findOne(ctx, id);
        if (!existing) throw new NotFoundError('Invoice not found');
        if (existing.status !== 'DRAFT') {
            throw new ApiError(
                'Only DRAFT invoices can be posted',
                400,
                'INVALID_STATUS',
            );
        }
        return this.setStatus(ctx, id, 'POSTED');
    }

    async cancelOne(ctx: RequestContext, id: number): Promise<SalesInvoice> {
        const existing = await this.findOne(ctx, id);
        if (!existing) throw new NotFoundError('Invoice not found');
        if (existing.status !== 'POSTED') {
            throw new ApiError(
                'Only POSTED invoices can be cancelled',
                400,
                'INVALID_STATUS',
            );
        }
        const updated = await this.setStatus(ctx, id, 'CANCELLED');
        // Cancelling frees its quantity → re-derive both source documents.
        await this.syncSourceDocs(
            ctx,
            existing.shipment_id,
            existing.sales_order_id,
        );
        return updated;
    }

    /**
     * Outstanding invoices for the payment allocation grid — POSTED invoices
     * with amount_paid < grand_total. Server-side filtered (optional customer
     * name / number search) and paginated so a customer with thousands of
     * invoices never loads everything.
     */
    async findOutstanding(
        ctx: RequestContext,
        params: PaginationParams & { customer?: string; phone?: string },
    ): Promise<PaginatedResult<OutstandingInvoice>> {
        const isSuperUser = await this.isSupperUser(ctx);
        let query = this.applyFilter(
            this.db
                .from(HEADER_TABLE)
                .select(
                    'id, invoice_no, invoice_date, customer_name, customer_phone, currency, grand_total, amount_paid',
                    { count: 'exact' },
                ),
            ctx,
            isSuperUser,
        )
            .eq('status', 'POSTED')
            // Only invoices with a remaining balance (generated column, indexed).
            .gt('outstanding', 0)
            .order('id', { ascending: true }); // FIFO — oldest first

        // Customer match: free-text name OR phone (no customer master). Phone
        // disambiguates when names are entered inconsistently; either alone
        // still works.
        const clauses: string[] = [];
        if (params.customer) {
            clauses.push(`customer_name.ilike.%${params.customer}%`);
        }
        if (params.phone) {
            clauses.push(`customer_phone.eq.${params.phone}`);
        }
        if (clauses.length) {
            query = query.or(clauses.join(','));
        }
        if (params.search) {
            query = query.or(
                `invoice_no.ilike.%${params.search}%,reference_no.ilike.%${params.search}%`,
            );
        }

        const result = await this.paginate<Record<string, unknown>>(query, {
            ...params,
            search: undefined,
            searchColumn: undefined,
        });
        return {
            ...result,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            data: result.data.map((r: any) => ({
                id: r.id,
                invoice_no: r.invoice_no,
                invoice_date: r.invoice_date,
                customer_name: r.customer_name ?? null,
                customer_phone: r.customer_phone ?? null,
                currency: r.currency,
                grand_total: Number(r.grand_total),
                amount_paid: deriveInvoicePayment(
                    Number(r.grand_total),
                    Number(r.amount_paid ?? 0),
                ).amount_paid,
                outstanding: deriveInvoicePayment(
                    Number(r.grand_total),
                    Number(r.amount_paid ?? 0),
                ).outstanding,
            })),
        };
    }

    /** POSTED customer payments settling a given invoice (invoice Payments tab). */
    async findPayments(
        ctx: RequestContext,
        invoiceId: number,
    ): Promise<InvoicePaymentRef[]> {
        const companyId = Number(ctx.companyId);
        const { data: allocs, error } = await this.db
            .from('document_allocation')
            .select('source_id, amount')
            .eq('company_id', companyId)
            .eq('source_type', 'customer_payment')
            .eq('target_type', 'sales_invoice')
            .eq('target_id', invoiceId);
        if (error) throw new ApiError(error.message, 500);
        if (!allocs?.length) return [];

        const amountByPayment = new Map<number, number>();
        for (const a of allocs) {
            amountByPayment.set(
                a.source_id,
                (amountByPayment.get(a.source_id) ?? 0) + Number(a.amount),
            );
        }

        const { data: payments } = await this.db
            .from('customer_payment')
            .select(
                'id, payment_no, payment_date, payment_method, reference_no, status',
            )
            .eq('company_id', companyId)
            .in('id', [...amountByPayment.keys()])
            .eq('status', 'POSTED')
            .order('id', { ascending: false });

        return (payments ?? []).map((p) => ({
            id: p.id,
            payment_no: p.payment_no,
            payment_date: p.payment_date,
            payment_method: p.payment_method,
            reference_no: p.reference_no ?? null,
            status: p.status,
            amount: amountByPayment.get(p.id) ?? 0,
        }));
    }

    // ── internals ───────────────────────────────────────────────────────────

    private async insertLines(
        ctx: RequestContext,
        companyId: number,
        invoiceId: number,
        lines: InvoiceLineDraft[],
    ): Promise<void> {
        // Snapshot the conversion so a later edit to the item's UOM cannot
        // restate an issued invoice (service/core/uom-conversion.ts).
        const factors = await ItemUomRepository.getInstance().factorsByIds(
            ctx,
            lines.map((l) => l.item_uom_id),
        );
        const rows = lines.map((l) => ({
            invoice_id: invoiceId,
            company_id: companyId,
            item_id: l.item_id,
            sales_order_item_id: l.sales_order_item_id,
            shipment_item_id: l.shipment_item_id,
            description: l.description,
            uom: l.uom,
            item_uom_id: l.item_uom_id ?? null,
            conversion_factor: l.item_uom_id
                ? (factors.get(l.item_uom_id) ?? 1)
                : 1,
            quantity: l.quantity,
            unit_price: l.unit_price,
            discount: l.discount,
            tax: l.tax,
            line_total: lineTotal({
                quantity: l.quantity,
                unit_price: l.unit_price,
                discount: l.discount,
                tax: l.tax,
            }),
        }));
        const { error } = await this.db.from(LINE_TABLE).insert(rows);
        if (error) throw new ApiError(error.message, 500);
    }

    private async setStatus(
        ctx: RequestContext,
        id: number,
        status: SalesInvoiceStatus,
    ): Promise<SalesInvoice> {
        const { error } = await this.db
            .from(HEADER_TABLE)
            .update(this.stampUpdate(ctx, { status }))
            .eq('id', id)
            .eq('company_id', Number(ctx.companyId));
        if (error) throw new ApiError(error.message, 500);
        return (await this.findOne(ctx, id))!;
    }
}
