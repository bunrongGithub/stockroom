import { ItemUomRepository } from '@/service/apps/inventory/repo/item-uom';
import { InventorySerialRepository } from '@/service/apps/inventory/repo/serial';
import { validateSerialSelection } from '@/service/apps/inventory/repo/serial-validation';
import { CompanySettingsRepository } from '@/service/apps/setting/repo/company-settings';
import { ApiError, NotFoundError } from '@/service/core/api-response';
import { BaseRepository } from '@/service/core/base-repository';
import type { CashSaleInput } from '@/service/schema/cash-sale.schema';
import type { RequestContext } from '@/types/request-context';
import type {
    SalesInvoice,
    SalesOrder,
    SalesShipment,
} from '@/types/sales/order-management';
import type { CustomerPayment, InvoicePaymentStatus } from '@/types/sales/payment';
import type {
    PaginatedResult,
    PaginationParams,
} from '@/service/core/pagination';
import { deriveInvoicePayment } from '../payment-summary';
import { documentTotals } from '../pricing';
import { SalesInvoiceRepository } from '../repo/invoice';
import { SalesOrderRepository } from '../repo/order';
import { CustomerPaymentRepository } from '../repo/payment';
import { SalesShipmentRepository } from '../repo/shipment';
import { getPaymentGateway } from './gateway';

/**
 * Cash Sale — the retail counter workflow.
 *
 * This service owns NO business logic of its own and NO table of its own. A cash
 * sale IS a Sales Order → Shipment → Invoice → Payment, created and posted back
 * to back by the existing services; inventory only ever moves through the
 * movement engine, serials only ever through the serial engine.
 *
 * Because Supabase gives the app no cross-statement transaction, atomicity is
 * achieved by compensation: every step registers its inverse, and any failure
 * unwinds the stack in reverse so a half-finished sale can never strand stock,
 * serials, or money. The one irreversible-looking step — posting the shipment —
 * is undone by `SalesShipmentRepository.reversePosting`.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export type CashSaleResult = {
    order: SalesOrder;
    shipment: SalesShipment;
    invoice: SalesInvoice;
    payment: CustomerPayment;
};

/** One completed counter sale for the history list (order + its invoice). */
export type CashSaleListRow = {
    id: number; // sales_order id
    order_no: string;
    order_date: string;
    customer_name: string;
    currency: string;
    grand_total: number;
    status: string; // order status
    invoice_id: number | null;
    invoice_no: string | null;
    payment_status: InvoicePaymentStatus | null;
};

/** A line after the server has resolved price, UOM, location and serials. */
type ResolvedLine = {
    item_id: number;
    product_name: string;
    description: string | null;
    quantity: number;
    unit_price: number;
    discount: number;
    tax: number;
    item_uom_id: number | null;
    uom_name: string;
    location_id: number;
    track_serial: boolean;
    serial_numbers: string[];
    available: number;
};

export type ResolvedCashSale = {
    warehouse_id: number;
    warehouse_name: string;
    location_id: number;
    location_name: string;
    customer: { customer_id: number | null; name: string; phone: string | null };
    lines: ResolvedLine[];
    subtotal: number;
    discount_total: number;
    tax_total: number;
    grand_total: number;
    currency: string;
};

type ItemMaster = {
    id: number;
    name: string;
    description: string | null;
    item_class: string;
    is_sellable: boolean;
    track_serial: boolean;
    price: number;
    min_price: number | null;
    max_price: number | null;
};

// ─── Service ────────────────────────────────────────────────────────────────

export class CashSaleService extends BaseRepository {
    private static instance: CashSaleService;

    static getInstance(): CashSaleService {
        if (!CashSaleService.instance) {
            CashSaleService.instance = new CashSaleService();
        }
        return CashSaleService.instance;
    }

    private readonly orders = SalesOrderRepository.getInstance();
    private readonly shipments = SalesShipmentRepository.getInstance();
    private readonly invoices = SalesInvoiceRepository.getInstance();
    private readonly payments = CustomerPaymentRepository.getInstance();
    private readonly serials = InventorySerialRepository.getInstance();
    private readonly itemUoms = ItemUomRepository.getInstance();
    private readonly settings = CompanySettingsRepository.getInstance();

    // ── 0. History (read-only) ──────────────────────────────────────────────

    /**
     * Completed counter sales for the history list. A cash sale IS a sales
     * order on the `cash_sale` channel; each row is joined to its invoice so
     * the receipt can be reprinted. The invoice lookup is one batched query
     * bounded to the page, not per-row.
     */
    async listSales(
        ctx: RequestContext,
        params: PaginationParams,
    ): Promise<PaginatedResult<CashSaleListRow>> {
        const page = await this.orders.findAll(ctx, {
            ...params,
            sourceChannel: 'cash_sale',
        });
        if (!page.data.length) {
            return { ...page, data: [] };
        }

        const orderIds = page.data.map((o) => o.id);
        const { data: invoiceRows, error } = await this.db
            .from('sales_invoice')
            .select('id, invoice_no, sales_order_id, grand_total, amount_paid')
            .eq('company_id', Number(ctx.companyId))
            .in('sales_order_id', orderIds)
            .neq('status', 'CANCELLED');
        if (error) throw new ApiError(error.message, 500);

        // A cash sale raises exactly one invoice; keep the newest if ever more.
        const byOrder = new Map<number, (typeof invoiceRows)[number]>();
        for (const inv of invoiceRows ?? []) {
            if (inv.sales_order_id == null) continue;
            const existing = byOrder.get(inv.sales_order_id);
            if (!existing || inv.id > existing.id) {
                byOrder.set(inv.sales_order_id, inv);
            }
        }

        return {
            ...page,
            data: page.data.map((o) => {
                const inv = byOrder.get(o.id);
                return {
                    id: o.id,
                    order_no: o.order_no,
                    order_date: o.order_date,
                    customer_name: o.customer_name,
                    currency: o.currency,
                    grand_total: o.grand_total,
                    status: o.status,
                    invoice_id: inv?.id ?? null,
                    invoice_no: inv?.invoice_no ?? null,
                    payment_status: inv
                        ? deriveInvoicePayment(
                              Number(inv.grand_total),
                              Number(inv.amount_paid ?? 0),
                          ).payment_status
                        : null,
                };
            }),
        };
    }

    // ── 1. Validation (read-only) ───────────────────────────────────────────

    /**
     * Everything the sale needs, resolved and checked against live state, with
     * nothing written. The cashier screen calls this to preview totals; the
     * orchestrator calls it as the first step of `complete()` so a bad sale
     * fails before any document exists.
     */
    async validate(
        ctx: RequestContext,
        input: CashSaleInput,
    ): Promise<ResolvedCashSale> {
        const companyId = Number(ctx.companyId);

        // Warehouse + location: from Sales Settings unless explicitly overridden.
        const { warehouse, location } = await this.resolveDestination(
            ctx,
            input,
        );

        const items = await this.loadSellableItems(
            companyId,
            input.items.map((l) => l.item_id),
        );

        const lines: ResolvedLine[] = [];
        // The same item can appear on several lines (different price, serials).
        // Availability is checked against the RUNNING total per item+location,
        // otherwise two lines of the last unit would each pass on their own.
        const demand = new Map<string, number>();
        const claimedSerials = new Set<string>();

        for (const line of input.items) {
            const item = items.get(line.item_id);
            if (!item) {
                throw new ApiError(
                    `Item #${line.item_id} is not available for sale.`,
                    400,
                    'ITEM_NOT_SELLABLE',
                );
            }

            // Price: the client's number is a suggestion, never an authority.
            const unitPrice = line.unit_price ?? Number(item.price);
            if (item.min_price != null && unitPrice < Number(item.min_price)) {
                throw new ApiError(
                    `${item.name}: price ${unitPrice} is below the minimum ${item.min_price}.`,
                    400,
                    'PRICE_OUT_OF_RANGE',
                );
            }
            if (item.max_price != null && unitPrice > Number(item.max_price)) {
                throw new ApiError(
                    `${item.name}: price ${unitPrice} is above the maximum ${item.max_price}.`,
                    400,
                    'PRICE_OUT_OF_RANGE',
                );
            }

            const locationId = line.location_id ?? location.id;
            await this.assertLocationInWarehouse(locationId, warehouse.id);

            // Stock: available (on hand − reserved), not just on hand.
            const available = await this.availableQty(
                companyId,
                line.item_id,
                warehouse.id,
                locationId,
            );
            const key = `${line.item_id}:${locationId}`;
            const required = (demand.get(key) ?? 0) + line.quantity;
            demand.set(key, required);
            if (available < required) {
                throw new ApiError(
                    `${item.name}: only ${available} available at ${location.name}.`,
                    422,
                    'INSUFFICIENT_STOCK',
                );
            }

            const serialNumbers = [
                ...new Set(
                    (line.serial_numbers ?? [])
                        .map((s) => s.trim())
                        .filter(Boolean),
                ),
            ];
            for (const serial of serialNumbers) {
                if (claimedSerials.has(serial)) {
                    throw new ApiError(
                        `Serial ${serial} appears on more than one line.`,
                        400,
                        'DUPLICATE_SERIAL',
                    );
                }
                claimedSerials.add(serial);
            }
            if (item.track_serial) {
                try {
                    validateSerialSelection({
                        quantity: line.quantity,
                        serials: serialNumbers,
                    });
                } catch (e) {
                    throw new ApiError(
                        e instanceof Error
                            ? `${item.name}: ${e.message}`
                            : `${item.name}: invalid serial selection`,
                        400,
                        'SERIAL_QUANTITY',
                    );
                }
                const selectable = await this.serials.findSelectableForSale(
                    ctx,
                    {
                        itemId: line.item_id,
                        warehouseId: warehouse.id,
                        locationId,
                        serialNumbers,
                    },
                );
                if (selectable.length !== serialNumbers.length) {
                    const found = new Set(
                        selectable.map((s) => s.serial_number),
                    );
                    const missing = serialNumbers.filter((s) => !found.has(s));
                    throw new ApiError(
                        `${item.name}: serial(s) not available at ${location.name}: ${missing.join(', ')}`,
                        409,
                        'SERIAL_NOT_AVAILABLE',
                    );
                }
            } else if (serialNumbers.length) {
                throw new ApiError(
                    `${item.name} is not serial-tracked.`,
                    400,
                    'SERIAL_NOT_TRACKED',
                );
            }

            const itemUom =
                (line.item_uom_id
                    ? await this.itemUoms.findOne(ctx, line.item_uom_id)
                    : null) ??
                (await this.itemUoms.findDefaultByItem(ctx, line.item_id));

            lines.push({
                item_id: line.item_id,
                product_name: item.name,
                description: line.description ?? item.description ?? item.name,
                quantity: line.quantity,
                unit_price: unitPrice,
                discount: line.discount ?? 0,
                tax: line.tax ?? 0,
                item_uom_id: itemUom?.id ?? null,
                uom_name: itemUom?.name ?? '',
                location_id: locationId,
                track_serial: item.track_serial,
                serial_numbers: serialNumbers,
                available,
            });
        }

        const totals = documentTotals(
            lines.map((l) => ({
                quantity: l.quantity,
                unit_price: l.unit_price,
                discount: l.discount,
                tax: l.tax,
            })),
        );

        return {
            warehouse_id: warehouse.id,
            warehouse_name: warehouse.name,
            location_id: location.id,
            location_name: location.name,
            customer: await this.resolveCustomer(ctx, input),
            lines,
            currency: input.currency ?? 'USD',
            ...totals,
        };
    }

    // ── 2. Completion (the saga) ────────────────────────────────────────────

    /**
     * Complete the sale. Creates and posts the whole chain; on ANY failure the
     * compensation stack unwinds every step already applied, so the system ends
     * up exactly where it started.
     */
    async complete(
        ctx: RequestContext,
        input: CashSaleInput,
    ): Promise<CashSaleResult> {
        // Retry / double-click protection: the same key never sells twice.
        if (input.idempotency_key) {
            const existing = await this.orders.findByIdempotencyKey(
                ctx,
                input.idempotency_key,
            );
            if (existing) return this.loadResultForOrder(ctx, existing);
        }

        const sale = await this.validate(ctx, input);
        const gateway = getPaymentGateway(input.payment_method);
        const today = new Date().toISOString().slice(0, 10);

        // Each entry undoes the step that pushed it. Unwound last-in-first-out.
        const compensations: { label: string; undo: () => Promise<void> }[] = [];

        try {
            // ── Sales Order ──────────────────────────────────────────────────
            const order = await this.orders.insertOne(ctx, {
                customer_name: sale.customer.name,
                customer_phone: sale.customer.phone,
                customer_id: sale.customer.customer_id,
                source_channel: 'cash_sale',
                idempotency_key: input.idempotency_key ?? null,
                order_date: today,
                warehouse_id: sale.warehouse_id,
                currency: sale.currency,
                notes: input.notes ?? null,
                items: sale.lines.map((l) => ({
                    item_id: l.item_id,
                    item_uom_id: l.item_uom_id,
                    description: l.description,
                    uom: l.uom_name,
                    ordered_qty: l.quantity,
                    unit_price: l.unit_price,
                    discount: l.discount,
                    tax: l.tax,
                })),
            });
            compensations.push({
                label: `delete order ${order.order_no}`,
                undo: () => this.orders.deleteOne(ctx, order.id),
            });

            // Order lines and sale lines are created in the same order, so they
            // pair up positionally — that is how a shipment line finds its
            // sales_order_item_id.
            const orderLineIds = order.items.map((i) => i.id);

            // ── Shipment (DRAFT) ─────────────────────────────────────────────
            const draftShipment = await this.shipments.insertOne(ctx, {
                sales_order_id: order.id,
                customer_name: sale.customer.name,
                customer_phone: sale.customer.phone,
                delivery_date: today,
                warehouse_id: sale.warehouse_id,
                notes: input.notes ?? null,
                items: sale.lines.map((l, i) => ({
                    sales_order_item_id: orderLineIds[i],
                    item_id: l.item_id,
                    location_id: l.location_id,
                    item_uom_id: l.item_uom_id,
                    ordered_qty: l.quantity,
                    previously_shipped_qty: 0,
                    shipment_qty: l.quantity,
                    serial_numbers: l.serial_numbers,
                })),
            });
            compensations.push({
                label: `delete shipment ${draftShipment.shipment_no}`,
                undo: () => this.shipments.deleteOne(ctx, draftShipment.id),
            });

            // ── Post the shipment: stock leaves, serials are sold ────────────
            const shipment = await this.shipments.postOne(
                ctx,
                draftShipment.id,
            );
            compensations.push({
                label: `reverse posting of shipment ${shipment.shipment_no}`,
                undo: async () => {
                    await this.shipments.reversePosting(ctx, shipment.id);
                },
            });

            // ── Invoice ──────────────────────────────────────────────────────
            const draftInvoice = await this.invoices.createFromShipment(ctx, {
                shipment_id: shipment.id,
                customer_name: sale.customer.name,
                customer_phone: sale.customer.phone,
                invoice_date: today,
                currency: sale.currency,
                exchange_rate: 1,
            });
            // One compensation covers the invoice in either state: a POSTED
            // invoice is cancelled first, and the row is then removed so it does
            // not hold its shipment and order in place via the FK chain.
            compensations.push({
                label: `remove invoice ${draftInvoice.invoice_no}`,
                undo: async () => {
                    const current = await this.invoices.findOne(
                        ctx,
                        draftInvoice.id,
                    );
                    if (!current) return;
                    if (current.status === 'POSTED') {
                        await this.invoices.cancelOne(ctx, current.id);
                        await this.invoices.deleteCancelled(ctx, current.id);
                    } else if (current.status === 'CANCELLED') {
                        await this.invoices.deleteCancelled(ctx, current.id);
                    } else {
                        await this.invoices.deleteOne(ctx, current.id);
                    }
                },
            });

            const invoice = await this.invoices.postOne(ctx, draftInvoice.id);

            // ── Take the money ───────────────────────────────────────────────
            // Cash/card/bank/cheque settle at the counter; KHQR would return
            // PENDING here and the sale would not be recorded as paid.
            const charge = await gateway.createCharge(ctx, {
                amount: invoice.grand_total,
                currency: sale.currency,
                reference_no: input.payment_reference_no,
                description: `Cash sale ${invoice.invoice_no}`,
            });
            if (charge.status !== 'SETTLED') {
                throw new ApiError(
                    `Payment was not completed (${charge.status}).`,
                    402,
                    'PAYMENT_NOT_SETTLED',
                );
            }

            const draftPayment = await this.payments.create(ctx, {
                payment_date: today,
                customer_name: sale.customer.name,
                customer_phone: sale.customer.phone,
                payment_method: input.payment_method,
                reference_no: charge.reference_no,
                currency: sale.currency,
                amount: invoice.grand_total,
                remarks: `Cash sale ${invoice.invoice_no}`,
                allocations: [
                    { invoice_id: invoice.id, amount: invoice.grand_total },
                ],
            });
            compensations.push({
                label: `delete payment ${draftPayment.payment_no}`,
                undo: () => this.payments.deleteOne(ctx, draftPayment.id),
            });

            const payment = await this.payments.postOne(ctx, draftPayment.id);

            return {
                order: (await this.orders.findOne(ctx, order.id))!,
                shipment: (await this.shipments.findOne(ctx, shipment.id))!,
                invoice: (await this.invoices.findOne(ctx, invoice.id))!,
                payment,
            };
        } catch (err) {
            await this.compensate(compensations);
            throw err;
        }
    }

    /**
     * Unwind every applied step, newest first. A compensation that itself fails
     * is logged and the rest still run: the goal is to give back as much as
     * possible, and the original error is always what the caller sees.
     */
    private async compensate(
        compensations: { label: string; undo: () => Promise<void> }[],
    ): Promise<void> {
        for (const step of [...compensations].reverse()) {
            try {
                await step.undo();
            } catch (undoErr) {
                console.error(
                    `[cash-sale] compensation failed — ${step.label}:`,
                    undoErr,
                );
            }
        }
    }

    // ── Lookups ─────────────────────────────────────────────────────────────

    /** Reassemble the documents of an already-completed sale (idempotent replay). */
    private async loadResultForOrder(
        ctx: RequestContext,
        order: SalesOrder,
    ): Promise<CashSaleResult> {
        const { data: shipmentRow } = await this.db
            .from('sales_shipment')
            .select('id')
            .eq('company_id', Number(ctx.companyId))
            .eq('sales_order_id', order.id)
            .order('id', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (!shipmentRow) {
            throw new NotFoundError(
                'This sale was started but never completed. Void it and sell again.',
            );
        }

        const shipment = (await this.shipments.findOne(ctx, shipmentRow.id))!;
        const [invoice] = await this.invoices.findByShipment(ctx, shipment.id);
        if (!invoice) {
            throw new NotFoundError(
                'This sale was started but never invoiced. Void it and sell again.',
            );
        }
        const [paymentRef] = await this.invoices.findPayments(ctx, invoice.id);
        const payment = paymentRef
            ? await this.payments.findOne(ctx, paymentRef.id)
            : null;
        if (!payment) {
            throw new NotFoundError(
                'This sale was started but never paid. Void it and sell again.',
            );
        }

        return { order, shipment, invoice, payment };
    }

    private async resolveDestination(
        ctx: RequestContext,
        input: CashSaleInput,
    ): Promise<{
        warehouse: { id: number; name: string };
        location: { id: number; name: string };
    }> {
        const companyId = Number(ctx.companyId);
        const settings = await this.settings.get(ctx);

        const warehouseId =
            input.warehouse_id ?? settings.default_sales_warehouse_id;
        if (!warehouseId) {
            throw new ApiError(
                'No default sales warehouse is configured. Set one in Sale → Settings.',
                400,
                'SALES_WAREHOUSE_NOT_SET',
            );
        }

        const { data: warehouse, error: whErr } = await this.db
            .from('warehouse')
            .select('id, name')
            .eq('id', warehouseId)
            .eq('company_id', companyId)
            .maybeSingle();
        if (whErr) throw new ApiError(whErr.message, 500);
        if (!warehouse) throw new NotFoundError('Sales warehouse not found');

        // A location override wins; otherwise the configured default, but only
        // if it belongs to the warehouse we are actually selling from (a
        // warehouse override invalidates the configured location).
        let locationId = input.location_id ?? null;
        if (!locationId && settings.default_sales_location_id) {
            const { data: configured } = await this.db
                .from('warehouse_location')
                .select('id')
                .eq('id', settings.default_sales_location_id)
                .eq('warehouse_id', warehouse.id)
                .maybeSingle();
            if (configured) locationId = configured.id;
        }
        if (!locationId) {
            const { data: fallback } = await this.db
                .from('warehouse_location')
                .select('id')
                .eq('warehouse_id', warehouse.id)
                .eq('is_active', true)
                .order('is_default', { ascending: false })
                .order('id', { ascending: true })
                .limit(1)
                .maybeSingle();
            locationId = fallback?.id ?? null;
        }
        if (!locationId) {
            throw new ApiError(
                `Warehouse "${warehouse.name}" has no active location to sell from.`,
                400,
                'SALES_LOCATION_NOT_SET',
            );
        }

        const { data: location, error: locErr } = await this.db
            .from('warehouse_location')
            .select('id, name, warehouse_id')
            .eq('id', locationId)
            .maybeSingle();
        if (locErr) throw new ApiError(locErr.message, 500);
        if (!location || location.warehouse_id !== warehouse.id) {
            throw new ApiError(
                'The selected location does not belong to the sales warehouse.',
                400,
                'LOCATION_MISMATCH',
            );
        }

        return {
            warehouse: { id: warehouse.id, name: warehouse.name },
            location: { id: location.id, name: location.name },
        };
    }

    /** Walk-in by default; a registered customer is verified against the master. */
    private async resolveCustomer(
        ctx: RequestContext,
        input: CashSaleInput,
    ): Promise<{ customer_id: number | null; name: string; phone: string | null }> {
        const requested = input.customer;
        if (!requested?.customer_id) {
            return {
                customer_id: null,
                name: requested?.name?.trim() || 'Walk-in Customer',
                phone: requested?.phone?.trim() || null,
            };
        }

        const { data, error } = await this.db
            .from('customer')
            .select('id, name, phone')
            .eq('id', requested.customer_id)
            .eq('company_id', Number(ctx.companyId))
            .eq('is_active', true)
            .maybeSingle();
        if (error) throw new ApiError(error.message, 500);
        if (!data) throw new NotFoundError('Customer not found');

        // The document snapshots the master's values, not the client's.
        return { customer_id: data.id, name: data.name, phone: data.phone };
    }

    private async loadSellableItems(
        companyId: number,
        itemIds: number[],
    ): Promise<Map<number, ItemMaster>> {
        const { data, error } = await this.db
            .from('inventory_item')
            .select(
                'id, name, description, item_class, is_sellable, track_serial, price, min_price, max_price',
            )
            .eq('company_id', companyId)
            .eq('item_class', 'stock')
            .eq('is_sellable', true)
            .in('id', [...new Set(itemIds)]);
        if (error) throw new ApiError(error.message, 500);

        return new Map(
            (data ?? []).map((r) => [r.id, r as unknown as ItemMaster]),
        );
    }

    /** Available = on hand − reserved (a generated column on the balance row). */
    private async availableQty(
        companyId: number,
        itemId: number,
        warehouseId: number,
        locationId: number,
    ): Promise<number> {
        const { data, error } = await this.db
            .from('inventory_balances')
            .select('qty_available')
            .eq('company_id', companyId)
            .eq('item_id', itemId)
            .eq('warehouse_id', warehouseId)
            .eq('location_id', locationId)
            .maybeSingle();
        if (error) throw new ApiError(error.message, 500);
        return Number(data?.qty_available ?? 0);
    }

    private async assertLocationInWarehouse(
        locationId: number,
        warehouseId: number,
    ): Promise<void> {
        const { data, error } = await this.db
            .from('warehouse_location')
            .select('id')
            .eq('id', locationId)
            .eq('warehouse_id', warehouseId)
            .maybeSingle();
        if (error) throw new ApiError(error.message, 500);
        if (!data) {
            throw new ApiError(
                'The selected location does not belong to the sales warehouse.',
                400,
                'LOCATION_MISMATCH',
            );
        }
    }
}
