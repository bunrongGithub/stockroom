export type InventoryItemClass = 'stock' | 'non_stock' | 'service';

export interface InventoryItemProps {
    id: number | null;
    name: string;
    item_class: InventoryItemClass;
    reference_no: string;
    // Backend returns `price` / `cost`; form state uses `sale_price` / `purchase_price`
    price?: number | null;
    cost?: number | null;
    purchase_price: number;
    sale_price: number;
    min_price?: number | null;
    max_price?: number | null;
    description: string | null;
    stock: number | TStockQuantity | null;
    stock_entry: TStockLogEntry[] | null;
    category_id: number | null;
    category: TCategory | null;
    uom_id: number | null;
    uom: TUOM | null;
    images_url: string[] | null;
    stock_location?: TStockLocationSummary | null;
    stock_balances?: TStockBalanceRow[];
    warranty_duration?: string | null;
    labor_cost?: number | null;
    estimated_duration?: string | null;
    // Extra fields returned by backend list/detail endpoints
    sku?: string | null;
    brand?: string | null;
    condition?: string | null;
    min_stock?: number | null;
    is_warranty: boolean | false;
    is_discount?: boolean;
    is_discountable?: boolean;
    is_returnable?: boolean;
    is_sellable?: boolean;
    supplier?: string | null;
    barcode?: string | null;
    difficulty?: string | null;
}

export type TCategory = {
    id: number | null;
    name: string;
    reference_no?: string | null;
};
export type TUOM = { id: number | null; name: string };
export type TStockQuantity = {
    stock_onhand: number;
    item_id: number | null;
    stock_reserved: number;
    availiable_to_sell: number;
};
export interface TStockLogEntry {
    id: number;
    quantity: number;
    reason: TStockLogReason;
    posted_at: string;
    posted_by?: string;
    reference?: string;
}

export type TStockLogReason = string;

// ── NEW types ──
export type TStockLocationSummary = {
    location_id: number | null;
    location_name: string | null;
    location_code?: string | null;
    branch_id?: number | null;
    branch_name: string | null;
    is_default?: boolean;
    quantity: number;
};

export type TStockBalanceRow = {
    location_id?: number | null;
    location_name?: string;
    location_code?: string | null;
    branch_id?: number | null;
    branch_name?: string;
    quantity: number;
};
