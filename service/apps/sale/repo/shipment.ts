import { BaseRepository } from '@/service/core/base-repository';
import type {
    PaginationParams,
    PaginatedResult,
} from '@/service/core/pagination';
import type { RequestContext } from '@/types/request-context';
import { generateSequenNumbering } from '@/lib/utils/sequenumbering';
import { ApiError, NotFoundError } from '@/service/core/api-response';
import { MovementRepository } from '@/service/apps/inventory/repo/movement';
import { ItemUomRepository } from '@/service/apps/inventory/repo/item-uom';
import { SalesOrderRepository } from './order';
import type {
    CreateSalesShipmentInput,
    UpdateSalesShipmentInput,
} from '@/service/schema/sale-shipment.schema';
import type {
    SalesShipment,
    SalesShipmentItem,
    SalesShipmentStatus,
    SalesShipmentActions,
} from '@/types/sales/order-management';
import type { SalesOrder } from '@/types/sales/order-management';

const HEADER_TABLE = 'sales_shipment' as const;
const LINE_TABLE = 'sales_shipment_items' as const;

const SELECT_LIST =
    '*, sales_order:sales_order(id, order_no), warehouse:warehouse(id, name)';
const SELECT_DETAIL =
    '*, sales_order:sales_order(id, order_no), warehouse:warehouse(id, name), items:sales_shipment_items(*, item:inventory_item(id, name), location:warehouse_location(id, name), item_uom:inventory_item_uom(id, name, display_name))';

/** Only DRAFT shipments can be edited, posted, or voided (POSTED is immutable). */
export function computeShipmentActions(
    status: SalesShipmentStatus,
): SalesShipmentActions {
    const isDraft = status === 'DRAFT';
    return { can_update: isDraft, can_post: isDraft, can_void: isDraft };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapShipmentItem(r: any): SalesShipmentItem {
    return {
        id: r.id,
        sales_order_item_id: r.sales_order_item_id,
        item_id: r.item_id,
        product_name: r.item?.name ?? `#${r.item_id}`,
        location_id: r.location_id,
        location_name: r.location?.name ?? '',
        item_uom_id: r.item_uom_id ?? null,
        uom: r.item_uom?.name ?? '',
        ordered_qty: Number(r.ordered_qty),
        previously_shipped_qty: Number(r.previously_shipped_qty),
        shipment_qty: Number(r.shipment_qty),
    };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapShipment(r: any): SalesShipment {
    return {
        id: r.id,
        shipment_no: r.shipment_no,
        sales_order_id: r.sales_order_id,
        sales_order_no: r.sales_order?.order_no ?? '',
        customer_name: r.customer_name ?? null,
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

// ─── Repository ─────────────────────────────────────────────────────────────

export class SalesShipmentRepository extends BaseRepository {
    private static instance: SalesShipmentRepository;

    static getInstance(): SalesShipmentRepository {
        if (!SalesShipmentRepository.instance) {
            SalesShipmentRepository.instance = new SalesShipmentRepository();
        }
        return SalesShipmentRepository.instance;
    }

    async findAll(
        ctx: RequestContext,
        params: PaginationParams,
    ): Promise<PaginatedResult<SalesShipment>> {
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
        return { ...result, data: result.data.map(mapShipment) };
    }

    async findOne(
        ctx: RequestContext,
        id: number,
    ): Promise<SalesShipment | null> {
        const isSuperUser = await this.isSupperUser(ctx);
        const { data, error } = await this.applyFilter(
            this.db.from(HEADER_TABLE).select(SELECT_DETAIL).eq('id', id),
            ctx,
            isSuperUser,
        ).maybeSingle();
        if (error) throw new ApiError(error.message, 500);
        return data ? mapShipment(data) : null;
    }

    async insertOne(
        ctx: RequestContext,
        input: CreateSalesShipmentInput,
    ): Promise<SalesShipment> {
        const companyId = Number(ctx.companyId);
        const order = await this.loadShippableOrder(ctx, input.sales_order_id);
        this.validateLines(order, input.items);

        const shipment_no = generateSequenNumbering('SH');
        const { data: header, error } = await this.db
            .from(HEADER_TABLE)
            .insert({
                company_id: companyId,
                user_id: ctx.userId,
                shipment_no,
                sales_order_id: input.sales_order_id,
                customer_name: input.customer_name ?? order.customer_name,
                delivery_date: input.delivery_date,
                warehouse_id: input.warehouse_id ?? order.warehouse_id,
                status: 'DRAFT',
                receiver_name: input.receiver_name ?? null,
                delivery_address: input.delivery_address ?? null,
                notes: input.notes ?? null,
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
            .update({
                customer_name: input.customer_name ?? null,
                delivery_date: input.delivery_date,
                warehouse_id: input.warehouse_id,
                receiver_name: input.receiver_name ?? null,
                delivery_address: input.delivery_address ?? null,
                notes: input.notes ?? null,
            })
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

        // 2. Accrue shipped quantities + recompute order status.
        await orderService.incrementShipped(
            ctx,
            shipment.items.map((l) => ({
                sales_order_item_id: l.sales_order_item_id,
                qty: l.shipment_qty,
            })),
        );
        await orderService.recomputeStatus(ctx, shipment.sales_order_id);

        // 3. Mark posted.
        const { error } = await this.db
            .from(HEADER_TABLE)
            .update({ status: 'POSTED' })
            .eq('id', id)
            .eq('company_id', companyId);
        if (error) throw new ApiError(error.message, 500);

        return (await this.findOne(ctx, id))!;
    }

    /** Void a DRAFT shipment (POSTED cannot be voided — reverse via a return). */
    async voidOne(ctx: RequestContext, id: number): Promise<SalesShipment> {
        const existing = await this.findOne(ctx, id);
        if (!existing) throw new NotFoundError('Shipment not found');
        if (existing.status === 'VOID') {
            throw new ApiError('Shipment is already voided', 400, 'INVALID_STATUS');
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
            .update({ status: 'VOID' })
            .eq('id', id)
            .eq('company_id', Number(ctx.companyId));
        if (error) throw new ApiError(error.message, 500);
        return (await this.findOne(ctx, id))!;
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
        }));
        const { error } = await this.db.from(LINE_TABLE).insert(rows);
        if (error) throw new ApiError(error.message, 500);
    }
}
