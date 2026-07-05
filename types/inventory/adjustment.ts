// ── Stock Adjustment ────────────────────────────────────────────────────────
// Corrects inventory THROUGH the movement engine — balances are never edited
// directly. adjustment_qty is signed: positive = stock IN, negative = OUT.

export type StockAdjustmentStatus = 'DRAFT' | 'POSTED' | 'VOID';

export interface AdjustmentReason {
    code: string;
    label: string;
}

export interface StockAdjustmentItem {
    id: number;
    item_id: number;
    item_uom_id: number | null;
    product_name: string;
    sku: string | null;
    track_serial: boolean;
    uom: string;
    description: string | null;
    current_qty: number;
    adjustment_qty: number; // signed
    new_qty: number;
    unit_cost: number | null;
    serial_numbers: string[];
    remarks: string | null;
}

export interface StockAdjustmentActions {
    can_update: boolean;
    can_post: boolean;
    can_void: boolean;
    can_delete: boolean;
}

export interface StockAdjustment {
    id: number;
    adjustment_no: string;
    reference_no: string | null;
    adjustment_date: string;
    warehouse_id: number;
    warehouse_name: string;
    location_id: number;
    location_name: string;
    reason_code: string;
    reason_label: string;
    remarks: string | null;
    status: StockAdjustmentStatus;
    posted_by: string | null;
    posted_at: string | null;
    created_at: string;
    updated_at: string;
    items: StockAdjustmentItem[];
    /** Net signed quantity across lines (display convenience). */
    total_in: number;
    total_out: number;
    actions?: StockAdjustmentActions;
}

// ── Payloads (frontend → API) ───────────────────────────────────────────────

export interface StockAdjustmentLinePayload {
    id?: number; // present on edit for diff-sync
    item_id: number;
    item_uom_id?: number | null;
    description?: string;
    current_qty: number;
    adjustment_qty: number; // signed, non-zero
    unit_cost?: number | null;
    serial_numbers?: string[];
    remarks?: string;
}

export interface CreateStockAdjustmentPayload {
    reference_no?: string;
    adjustment_date: string;
    warehouse_id: number;
    location_id: number;
    reason_code: string;
    remarks?: string;
    items: StockAdjustmentLinePayload[];
}
