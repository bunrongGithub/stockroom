export interface InventoryItemProps {
    id: number | null;
    name: string;
    item_class: 'stock' | 'non_stock';
    reference_no: string;
    purchase_price: number;
    sale_price: number;
    description: string | null;
    stock: TStockQuantity | null;
    stock_entry: TStockLogEntry[] | null;
    category_id: number | null;
    category: TCategory | null;
    uom_id: number | null;
    uom: TUOM | null;
    images_url: string[] | null;
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
    posted_at: string; // ISO date string
    posted_by?: string;
    reference?: string;
}

export type TStockLogReason =
    | 'Opening Warehouse Inventory Balance Setup'
    | 'Cycle Count Correction'
    | 'Direct Manual Vendor Arrival';
