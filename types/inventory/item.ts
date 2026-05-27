export type InventoryItemClass = 'stock' | 'non_stock' | 'service';

export interface InventoryItemProps {
    id: number | null;
    name: string;
    item_class: InventoryItemClass;
    reference_no: string;
    purchase_price: number;
    sale_price: number;
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
}

export type TCategory = {
    id: number | null;
    name: string;
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
