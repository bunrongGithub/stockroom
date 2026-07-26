import { behaviorOf } from '../../core/item-behavior.ts';

/**
 * Pure order-fulfillment derivation (unit-testable, no I/O).
 *
 * A line fulfills through the channel its item class requires: shippable
 * lines by shipping, direct-invoice lines by invoicing (item-behavior).
 */


export type FulfillmentLine = {
    ordered_qty: number;
    shipped_qty: number;
    invoiced_qty: number;
    item_class: string;
};

export type OrderProgressStatus = 'open' | 'partial_shipment' | 'closed';

export function fulfilledQty(line: FulfillmentLine): number {
    return behaviorOf(line.item_class).requiresShipment
        ? line.shipped_qty
        : line.invoiced_qty;
}

/** Progress status from per-line fulfillment. Never returns 'cancelled'. */
export function deriveOrderStatus(
    items: FulfillmentLine[],
): OrderProgressStatus {
    if (items.length === 0) return 'open';
    const allFulfilled = items.every(
        (i) => i.ordered_qty - fulfilledQty(i) <= 0,
    );
    const anyProgress = items.some((i) => fulfilledQty(i) > 0);
    if (allFulfilled) return 'closed';
    if (anyProgress) return 'partial_shipment';
    return 'open';
}
