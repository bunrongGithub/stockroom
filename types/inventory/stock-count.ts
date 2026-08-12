// ── Physical Stock Count ────────────────────────────────────────────────────
// A count session DISCOVERS variance against a frozen snapshot; completing it
// CORRECTS that variance by generating Stock Adjustments (one per location)
// through the existing adjustment service. There is no approval step — the
// counter who finishes the count is the one who commits it. Displayed variance
// = counted − snapshot; the generated adjustment targets counted − LIVE
// on-hand (drift is surfaced).

export type StockCountStatus =
    | 'DRAFT'
    | 'PREPARED'
    | 'COUNTING'
    | 'COMPLETED'
    | 'CANCELLED';

export type StockCountMode = 'full' | 'location' | 'category' | 'items';

/** How uncounted lines are treated at completion. */
export type UncountedPolicy = 'ignore' | 'zero';

export type SerialClassification = 'matched' | 'missing' | 'new' | 'foreign';

export interface StockCountScopeFilter {
    category_ids?: number[];
    item_ids?: number[];
}

export interface StockCountActions {
    can_update: boolean;
    can_delete: boolean;
    can_prepare: boolean;
    can_start: boolean;
    can_count: boolean;
    /** Finish the count: generate and post the adjustments, then close it. */
    can_complete: boolean;
    can_cancel: boolean;
}

export interface StockCountAdjustmentLink {
    adjustment_id: number;
    adjustment_no: string;
    status: string;
    location_id: number;
    location_name: string;
}

export interface StockCount {
    id: number;
    count_no: string;
    count_date: string;
    warehouse_id: number;
    warehouse_name: string;
    location_id: number | null;
    location_name: string | null;
    count_mode: StockCountMode;
    scope_filter: StockCountScopeFilter;
    uncounted_policy: UncountedPolicy;
    status: StockCountStatus;
    snapshot_at: string | null;
    counting_started_at: string | null;
    submitted_at: string | null;
    completed_at: string | null;
    cancelled_at: string | null;
    cancel_reason: string | null;
    remarks: string | null;
    created_at: string;
    updated_at: string;
    adjustments: StockCountAdjustmentLink[];
    actions?: StockCountActions;
}

export type StockCountLineStatus = 'PENDING' | 'COUNTED';

export interface StockCountItem {
    id: number;
    count_id: number;
    item_id: number;
    location_id: number;
    location_name?: string | null;
    item_uom_id: number | null;
    uom?: string | null;
    sku: string | null;
    item_name: string | null;
    is_serial: boolean;
    snapshot_qty: number;
    unit_cost: number | null;
    counted_qty: number | null;
    variance_qty: number | null;
    status: StockCountLineStatus;
    counted_at: string | null;
    remarks: string | null;
    /** Serial progress (serial lines only): scanned vs expected. */
    serial_scanned?: number;
    serial_expected?: number;
}

export interface StockCountSerial {
    id: number;
    count_item_id: number;
    serial_number: string;
    serial_id: number | null;
    is_expected: boolean;
    is_scanned: boolean;
    classification: SerialClassification | null;
    scanned_at: string | null;
}

export interface StockCountSummary {
    total_lines: number;
    counted_lines: number;
    pending_lines: number;
    positive_lines: number;
    negative_lines: number;
    zero_lines: number;
    qty_over: number;
    qty_short: number;
    variance_value: number;
    /** counted_lines / total_lines, 0–100 (0 when no lines). */
    progress_pct: number;
}

// ── Completion preview (dry run of the completion algorithm) ───────────────

export interface CompletionPreviewLine {
    line_id: number;
    item_id: number;
    sku: string | null;
    item_name: string | null;
    is_serial: boolean;
    snapshot_qty: number;
    counted_qty: number;
    live_qty: number;
    /** counted − snapshot: what the review screen shows. */
    shown_variance: number;
    /** counted − live: what the adjustment will actually move. */
    adjustment_qty: number;
    /** live ≠ snapshot — inventory moved during the count. */
    drift: boolean;
    serial_numbers: string[];
}

export interface CompletionPreviewLocation {
    location_id: number;
    location_name?: string | null;
    /** Adjustment already generated for this location (idempotent resume). */
    already_generated: boolean;
    lines: CompletionPreviewLine[];
}

export interface CompletionPreview {
    count_id: number;
    uncounted_policy: UncountedPolicy;
    uncounted_lines: number;
    locations: CompletionPreviewLocation[];
    /** Expected-missing serials no longer available (consumed mid-count) —
     *  dropped from the OUT set and reported here. */
    dropped_serials: { line_id: number; serial_number: string }[];
    /** Scanned serials that exist elsewhere — excluded from adjustment. */
    foreign_serials: { line_id: number; serial_number: string }[];
    total_adjustment_lines: number;
    has_variance: boolean;
}
