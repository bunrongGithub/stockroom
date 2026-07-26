/**
 * Item Behavior Strategy — the single source of truth for what an item class
 * means operationally.
 *
 * Every routing decision in the ERP ("does this line move stock?", "must it
 * ship before invoicing?", "may it carry serials?") is answered here and only
 * here. Business services and UI components consume these flags instead of
 * comparing item_class strings inline, so adding a future class (rental,
 * digital, subscription, asset) is one new registry entry — not a hunt
 * through the codebase.
 *
 * Pure and synchronous by design: no I/O, importable from server services,
 * API routes, and client components alike.
 */

export type ItemClass = 'stock' | 'non_stock' | 'service';

export interface ItemBehavior {
    readonly itemClass: ItemClass;
    /** Participates in movements, stock balances, and physical counts. */
    readonly requiresInventory: boolean;
    /** Must ship (and post) before it can be invoiced. */
    readonly requiresShipment: boolean;
    readonly requiresWarehouse: boolean;
    readonly requiresLocation: boolean;
    /** Class may carry serials; effective tracking = this && item.track_serial. */
    readonly supportsSerial: boolean;
    /** Posting a sale/receipt for this class writes an inventory movement. */
    readonly generatesMovement: boolean;
    /** Invoiceable straight from the sales order, no shipment needed. */
    readonly invoiceImmediately: boolean;
    /** Class-level saleability; the per-item is_sellable flag still applies. */
    readonly canBeSold: boolean;
    readonly canBePurchased: boolean;
}

const STOCK: ItemBehavior = {
    itemClass: 'stock',
    requiresInventory: true,
    requiresShipment: true,
    requiresWarehouse: true,
    requiresLocation: true,
    supportsSerial: true,
    generatesMovement: true,
    invoiceImmediately: false,
    canBeSold: true,
    canBePurchased: true,
};

const NON_STOCK: ItemBehavior = {
    itemClass: 'non_stock',
    requiresInventory: false,
    requiresShipment: false,
    requiresWarehouse: false,
    requiresLocation: false,
    supportsSerial: false,
    generatesMovement: false,
    invoiceImmediately: true,
    canBeSold: true,
    canBePurchased: true,
};

const SERVICE: ItemBehavior = {
    ...NON_STOCK,
    itemClass: 'service',
};

const REGISTRY: Record<ItemClass, ItemBehavior> = {
    stock: STOCK,
    non_stock: NON_STOCK,
    service: SERVICE,
};

export const ITEM_CLASSES = Object.keys(REGISTRY) as ItemClass[];

export function isItemClass(value: unknown): value is ItemClass {
    return typeof value === 'string' && value in REGISTRY;
}

/**
 * Resolve the behavior for an item class. Throws on unknown values so a typo
 * or an unregistered future class fails loudly instead of silently behaving
 * like stock.
 */
export function behaviorOf(itemClass: string): ItemBehavior {
    const behavior = REGISTRY[itemClass as ItemClass];
    if (!behavior) {
        throw new Error(`Unknown item class: ${itemClass}`);
    }
    return behavior;
}

/**
 * Split document lines into the shipment-bound portion and the
 * invoice-immediately portion. The line only needs to expose its snapshotted
 * item_class.
 */
export function partitionByShipment<T extends { item_class: string }>(
    lines: T[],
): { shippable: T[]; direct: T[] } {
    const shippable: T[] = [];
    const direct: T[] = [];
    for (const line of lines) {
        (behaviorOf(line.item_class).requiresShipment ? shippable : direct).push(
            line,
        );
    }
    return { shippable, direct };
}
