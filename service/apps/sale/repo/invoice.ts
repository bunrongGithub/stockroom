import { BaseRepository } from '@/service/core/base-repository';
import type {
    PaginationParams,
    PaginatedResult,
} from '@/service/core/pagination';
import type { RequestContext } from '@/types/request-context';
import { generateSequenNumbering } from '@/lib/utils/sequenumbering';
import { ApiError, NotFoundError } from '@/service/core/api-response';
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

const HEADER_TABLE = 'sales_invoice' as const;
const LINE_TABLE = 'sales_invoice_items' as const;

const SELECT_LIST =
    '*, shipment:sales_shipment(id, shipment_no), sales_order:sales_order(id, order_no)';
const SELECT_DETAIL =
    '*, shipment:sales_shipment(id, shipment_no), sales_order:sales_order(id, order_no), items:sales_invoice_items(*, item:inventory_item(id, name, sku, track_serial))';

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
        track_serial: r.item?.track_serial ?? false,
        description: r.description ?? '',
        uom: r.uom ?? '',
        quantity: Number(r.quantity),
        unit_price: Number(r.unit_price),
        discount: Number(r.discount),
        tax: Number(r.tax),
        line_total: Number(r.line_total),
    };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapInvoice(r: any): SalesInvoice {
    return {
        id: r.id,
        invoice_no: r.invoice_no,
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
    quantity: number;
    unit_price: number;
    discount: number;
    tax: number;
};

// ─── Repository ─────────────────────────────────────────────────────────────

export class SalesInvoiceRepository extends BaseRepository {
    private static instance: SalesInvoiceRepository;

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
        const query = this.applyFilter(
            this.db.from(HEADER_TABLE).select(SELECT_LIST, { count: 'exact' }),
            ctx,
            isSuperUser,
        ).order('id', { ascending: false });
        const result = await this.paginate<Record<string, unknown>>(
            query,
            params,
        );
        return { ...result, data: result.data.map(mapInvoice) };
    }

    async findOne(ctx: RequestContext, id: number): Promise<SalesInvoice | null> {
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

        return invoice;
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
     */
    async createFromShipment(
        ctx: RequestContext,
        input: CreateSalesInvoiceInput,
    ): Promise<SalesInvoice> {
        const companyId = Number(ctx.companyId);
        const shipmentRepo = SalesShipmentRepository.getInstance();

        const shipment = await shipmentRepo.findOne(ctx, input.shipment_id);
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
            input.shipment_id,
        );
        const editByShipItem = new Map(
            (input.items ?? []).map((i) => [i.shipment_item_id ?? 0, i]),
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
                quantity,
                unit_price: edit?.unit_price ?? ol?.unit_price ?? 0,
                discount: edit?.discount ?? ol?.discount ?? 0,
                tax: edit?.tax ?? ol?.tax ?? 0,
            });
        }

        if (!lines.length) {
            throw new ApiError(
                'Nothing left to invoice on this shipment.',
                400,
                'NOTHING_TO_INVOICE',
            );
        }

        const totals = documentTotals(
            lines.map((l) => ({
                quantity: l.quantity,
                unit_price: l.unit_price,
                discount: l.discount,
                tax: l.tax,
            })),
        );

        const { data: header, error } = await this.db
            .from(HEADER_TABLE)
            .insert({
                company_id: companyId,
                user_id: ctx.userId,
                invoice_no: generateSequenNumbering('INV'),
                shipment_id: input.shipment_id,
                sales_order_id: shipment.sales_order_id,
                customer_name: input.customer_name ?? shipment.customer_name,
                customer_phone: input.customer_phone ?? shipment.customer_phone,
                customer_address:
                    input.customer_address ?? shipment.delivery_address,
                invoice_date: input.invoice_date,
                currency: input.currency ?? order?.currency ?? 'USD',
                exchange_rate: input.exchange_rate ?? 1,
                status: 'DRAFT',
                ...totals,
                remarks: input.remarks ?? null,
            })
            .select()
            .single();
        if (error) throw new ApiError(error.message, 500);

        try {
            await this.insertLines(companyId, header.id, lines);
        } catch (err) {
            await this.db.from(HEADER_TABLE).delete().eq('id', header.id);
            throw err;
        }

        await shipmentRepo.recomputeInvoiceStatus(ctx, input.shipment_id);

        return (await this.findOne(ctx, header.id))!;
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
        if (input.items) {
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
            .update({
                customer_name: input.customer_name ?? existing.customer_name,
                customer_phone: input.customer_phone ?? existing.customer_phone,
                customer_address:
                    input.customer_address ?? existing.customer_address,
                invoice_date: input.invoice_date,
                currency: input.currency ?? existing.currency,
                exchange_rate: input.exchange_rate ?? existing.exchange_rate,
                remarks: input.remarks ?? null,
                ...totals,
            })
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
            await this.insertLines(companyId, id, lines);
            await SalesShipmentRepository.getInstance().recomputeInvoiceStatus(
                ctx,
                existing.shipment_id,
            );
        }

        return (await this.findOne(ctx, id))!;
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

        await SalesShipmentRepository.getInstance().recomputeInvoiceStatus(
            ctx,
            existing.shipment_id,
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
        // Cancelling frees its quantity → re-derive the shipment status.
        await SalesShipmentRepository.getInstance().recomputeInvoiceStatus(
            ctx,
            existing.shipment_id,
        );
        return updated;
    }

    // ── internals ───────────────────────────────────────────────────────────

    private async insertLines(
        companyId: number,
        invoiceId: number,
        lines: InvoiceLineDraft[],
    ): Promise<void> {
        const rows = lines.map((l) => ({
            invoice_id: invoiceId,
            company_id: companyId,
            item_id: l.item_id,
            sales_order_item_id: l.sales_order_item_id,
            shipment_item_id: l.shipment_item_id,
            description: l.description,
            uom: l.uom,
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
            .update({ status })
            .eq('id', id)
            .eq('company_id', Number(ctx.companyId));
        if (error) throw new ApiError(error.message, 500);
        return (await this.findOne(ctx, id))!;
    }
}
