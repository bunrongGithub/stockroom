'use client';

import { API } from '@/lib/constant';
import { unwrap } from '@/lib/api/sale';

/**
 * Reusable item-master lookup + auto-fill mechanism.
 *
 * The item SEARCH pickers (AsyncSearchSelect) only hand back `{ id, name }`, so
 * any transaction form that wants an item's price / cost / UOM / default
 * warehouse+location must fetch the item detail after selection. This module
 * centralizes that fetch, caches it per id (dedupes concurrent + repeat calls),
 * and normalizes the response into a single `ItemDefaults` shape that every
 * transaction line — Sales Order, Receipt, Adjustment, and future PO/Transfer/
 * Issue/Count — maps from. One place to fetch, one place to define "what an item
 * contributes to a line."
 */

/** Raw item-detail shape (subset we consume) returned by stockItem.detail(id). */
interface ItemDetailResponse {
    id: number;
    name: string;
    description?: string | null;
    price?: number | null; // selling price (backend column `price`)
    cost?: number | null;
    uom_id?: number | null;
    uom?: { id: number | null; name: string } | null;
    track_serial?: boolean | null;
    default_warehouse_id?: number | null;
    default_warehouse?: { id: number | null; name: string } | null;
    default_location_id?: number | null;
    default_location?: { id: number | null; name: string } | null;
    stock_location?: {
        location_id: number | null;
        location_name: string | null;
        quantity: number;
    } | null;
}

/** A per-item UOM conversion row (inventory_item_uom). */
interface ItemUomRow {
    id: number; // inventory_item_uom.id — this is what a line's `item_uom_id` stores
    name: string;
    is_default?: boolean;
}

/** Normalized defaults an item contributes to a transaction line. */
export interface ItemDefaults {
    itemId: number;
    name: string;
    description: string | null;
    price: number | null;
    cost: number | null;
    /**
     * The item's DEFAULT UOM row id — an `inventory_item_uom.id`, which is what
     * a transaction line's `item_uom_id` field references (NOT the base
     * `inventory_uom.id`). Null if the item has no UOM rows.
     */
    itemUomId: number | null;
    uomName: string;
    trackSerial: boolean;
    defaultWarehouseId: number | null;
    defaultWarehouseName: string;
    defaultLocationId: number | null;
    defaultLocationName: string;
}

/** Pure mapper: raw item detail + item-UOM rows → normalized line defaults. */
export function itemDefaults(
    item: ItemDetailResponse,
    itemUomRows: ItemUomRow[] = [],
): ItemDefaults {
    // A configured default_location wins; otherwise fall back to the item's
    // live default stock location (where quantity currently sits).
    const locId = item.default_location_id ?? item.stock_location?.location_id ?? null;
    const locName =
        item.default_location?.name ?? item.stock_location?.location_name ?? '';

    // The line stores an inventory_item_uom.id — resolve the item's default row
    // (is_default), falling back to the first available row.
    const defUom =
        itemUomRows.find((u) => u.is_default) ?? itemUomRows[0] ?? null;

    return {
        itemId: item.id,
        name: item.name,
        description: item.description ?? null,
        price: item.price ?? null,
        cost: item.cost ?? null,
        itemUomId: defUom?.id ?? null,
        uomName: defUom?.name ?? item.uom?.name ?? '',
        trackSerial: Boolean(item.track_serial),
        defaultWarehouseId: item.default_warehouse_id ?? item.default_warehouse?.id ?? null,
        defaultWarehouseName: item.default_warehouse?.name ?? '',
        defaultLocationId: locId,
        defaultLocationName: locName,
    };
}

// Per-id in-memory cache of the in-flight/resolved detail promise. Keyed by
// item id; lives for the page session. Dedupes repeat selections of the same
// item and concurrent lookups.
const detailCache = new Map<number, Promise<ItemDefaults>>();

export const itemApi = {
    /** Cached, normalized item-master defaults for a given item id. */
    getDefaults(id: number): Promise<ItemDefaults> {
        const cached = detailCache.get(id);
        if (cached) return cached;

        // Fetch the item detail and its UOM rows in parallel — the line needs
        // the default inventory_item_uom.id, which the detail endpoint doesn't
        // embed.
        const p = Promise.all([
            fetch(API.inventory.stockItem.detail(id)).then((r) =>
                unwrap<{ data: ItemDetailResponse }>(r),
            ),
            fetch(`${API.inventory.itemUom.root}?item_id=${id}&limit=100`)
                .then((r) => unwrap<{ data: ItemUomRow[] }>(r))
                .catch(() => ({ data: [] as ItemUomRow[] })), // UOM list is best-effort
        ])
            .then(([detailBody, uomBody]) =>
                itemDefaults(detailBody.data, uomBody.data ?? []),
            )
            .catch((e) => {
                // Don't cache failures — allow a retry on the next selection.
                detailCache.delete(id);
                throw e;
            });

        detailCache.set(id, p);
        return p;
    },

    /** Drop a cached item (e.g. after editing the item master). */
    invalidate(id: number): void {
        detailCache.delete(id);
    },
};
