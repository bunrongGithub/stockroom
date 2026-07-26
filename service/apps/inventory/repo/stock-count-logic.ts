// ─── Physical Stock Count — pure domain logic ───────────────────────────────
// Dependency-free (no `@/` imports) so `node --test tests/` can exercise it
// directly, mirroring serial-validation.ts. The repository layer feeds it
// database rows and translates its output into StockAdjustment payloads.

export type StockCountStatus =
    | 'DRAFT'
    | 'PREPARED'
    | 'COUNTING'
    | 'PENDING_APPROVAL'
    | 'APPROVED'
    | 'COMPLETED'
    | 'CANCELLED';

export type UncountedPolicy = 'ignore' | 'zero';

export type StockCountActions = {
    can_update: boolean;
    can_delete: boolean;
    can_prepare: boolean;
    can_start: boolean;
    can_count: boolean;
    can_submit: boolean;
    can_reopen: boolean;
    can_approve: boolean;
    can_cancel: boolean;
};

/** Status → allowed actions. The single state-machine authority; the UI and
 *  every repo guard read from here so they can never disagree. */
export function computeCountActions(status: StockCountStatus): StockCountActions {
    return {
        can_update: status === 'DRAFT',
        can_delete: status === 'DRAFT',
        can_prepare: status === 'DRAFT',
        can_start: status === 'PREPARED',
        can_count: status === 'COUNTING',
        can_submit: status === 'COUNTING',
        can_reopen: status === 'PENDING_APPROVAL',
        can_approve: status === 'PENDING_APPROVAL',
        can_cancel: !['APPROVED', 'COMPLETED', 'CANCELLED'].includes(status),
    };
}

// ── Serial scan classification ──────────────────────────────────────────────

export type ExistingSerialRow = {
    item_id: number;
    warehouse_id: number;
    location_id: number;
    status: string;
};

export type SerialBucket = {
    item_id: number;
    warehouse_id: number;
    location_id: number;
};

export type SerialClassification = 'matched' | 'new' | 'foreign';

export type ClassifiedSerial = {
    serial_number: string;
    classification: SerialClassification;
};

export type SerialScanResult = {
    accepted: ClassifiedSerial[];
    /** Serials belonging to a DIFFERENT item — a mis-scan, rejected outright. */
    rejected: { serial_number: string; reason: 'wrong_item' }[];
};

/**
 * Classify scanned serials against the frozen expected set and current DB
 * state:
 *   expected               → matched  (physically present, as the ERP said)
 *   unknown to the system  → new      (adjustment IN at approval)
 *   exists, same item      → foreign  (elsewhere / other status — investigate,
 *                                      never auto-adjusted)
 *   exists, other item     → rejected (scanning error)
 * Input is deduped; expected serials take precedence over DB state because the
 * snapshot already pinned them to this bucket.
 */
export function classifyScannedSerials(
    scanned: string[],
    expected: Set<string>,
    existing: Map<string, ExistingSerialRow>,
    bucket: SerialBucket,
): SerialScanResult {
    const accepted: ClassifiedSerial[] = [];
    const rejected: SerialScanResult['rejected'] = [];
    const seen = new Set<string>();

    for (const raw of scanned) {
        const serial = raw.trim();
        if (!serial || seen.has(serial)) continue;
        seen.add(serial);

        if (expected.has(serial)) {
            accepted.push({ serial_number: serial, classification: 'matched' });
            continue;
        }
        const row = existing.get(serial);
        if (!row) {
            accepted.push({ serial_number: serial, classification: 'new' });
        } else if (row.item_id !== bucket.item_id) {
            rejected.push({ serial_number: serial, reason: 'wrong_item' });
        } else {
            accepted.push({ serial_number: serial, classification: 'foreign' });
        }
    }
    return { accepted, rejected };
}

// ── Adjustment plan (the approve algorithm's pure core) ─────────────────────

export type CountLineInput = {
    line_id: number;
    item_id: number;
    location_id: number;
    item_uom_id: number | null;
    is_serial: boolean;
    snapshot_qty: number;
    counted_qty: number | null;
    unit_cost: number | null;
    sku?: string | null;
    item_name?: string | null;
};

/** Per-line serial reconciliation, resolved by the repo against live state. */
export type LineSerialSets = {
    /** Expected, never scanned, and STILL available → adjustment OUT. */
    missing: string[];
    /** Expected-missing but no longer available (consumed mid-count) —
     *  excluded from OUT, reported as drift. */
    dropped: string[];
    /** Scanned, unknown to the system → adjustment IN. */
    added: string[];
    /** Scanned but existing elsewhere → excluded, investigation only. */
    foreign: string[];
};

export type PlanLine = {
    line_id: number;
    item_id: number;
    location_id: number;
    item_uom_id: number | null;
    sku: string | null;
    item_name: string | null;
    is_serial: boolean;
    snapshot_qty: number;
    counted_qty: number;
    live_qty: number;
    shown_variance: number;
    adjustment_qty: number; // signed, non-zero
    drift: boolean;
    unit_cost: number | null;
    serial_numbers: string[];
};

export type AdjustmentPlan = {
    locations: { location_id: number; lines: PlanLine[] }[];
    dropped_serials: { line_id: number; serial_number: string }[];
    foreign_serials: { line_id: number; serial_number: string }[];
    uncounted_lines: number;
    total_adjustment_lines: number;
    has_variance: boolean;
};

export const bucketKey = (itemId: number, locationId: number): string =>
    `${itemId}:${locationId}`;

/**
 * Build the per-location adjustment plan.
 *
 * Displayed variance = counted − snapshot (what the review screen showed);
 * adjustment_qty = counted − LIVE on-hand, so stock lands exactly on the
 * counted figure even if inventory moved during the count (drift=true flags
 * those lines).
 *
 * Serial lines derive their adjustment from the serial sets — up to TWO plan
 * lines per item (OUT with missing serials, IN with new serials), because the
 * adjustment service requires |qty| === serial count per signed line.
 */
export function buildAdjustmentPlan(
    lines: CountLineInput[],
    liveQty: Map<string, number>,
    serialSets: Map<number, LineSerialSets>,
    policy: UncountedPolicy,
): AdjustmentPlan {
    const byLocation = new Map<number, PlanLine[]>();
    const droppedSerials: AdjustmentPlan['dropped_serials'] = [];
    const foreignSerials: AdjustmentPlan['foreign_serials'] = [];
    let uncounted = 0;

    const push = (line: PlanLine) => {
        const list = byLocation.get(line.location_id) ?? [];
        list.push(line);
        byLocation.set(line.location_id, list);
    };

    for (const line of lines) {
        const isUncounted = line.counted_qty === null;
        if (isUncounted) {
            uncounted += 1;
            if (policy === 'ignore') continue;
        }

        const live = liveQty.get(bucketKey(line.item_id, line.location_id)) ?? 0;
        const drift = live !== line.snapshot_qty;
        const base = {
            line_id: line.line_id,
            item_id: line.item_id,
            location_id: line.location_id,
            item_uom_id: line.item_uom_id,
            sku: line.sku ?? null,
            item_name: line.item_name ?? null,
            is_serial: line.is_serial,
            snapshot_qty: line.snapshot_qty,
            live_qty: live,
            drift,
        };

        if (line.is_serial) {
            const sets = serialSets.get(line.line_id) ?? {
                missing: [],
                dropped: [],
                added: [],
                foreign: [],
            };
            for (const s of sets.dropped)
                droppedSerials.push({ line_id: line.line_id, serial_number: s });
            for (const s of sets.foreign)
                foreignSerials.push({ line_id: line.line_id, serial_number: s });

            const counted = line.counted_qty ?? 0;
            const shown = counted - line.snapshot_qty;
            if (sets.missing.length > 0) {
                push({
                    ...base,
                    counted_qty: counted,
                    shown_variance: shown,
                    adjustment_qty: -sets.missing.length,
                    unit_cost: null,
                    serial_numbers: sets.missing,
                });
            }
            if (sets.added.length > 0) {
                push({
                    ...base,
                    counted_qty: counted,
                    shown_variance: shown,
                    adjustment_qty: sets.added.length,
                    unit_cost: line.unit_cost,
                    serial_numbers: sets.added,
                });
            }
            continue;
        }

        const counted = line.counted_qty ?? 0;
        const adjustment = counted - live;
        if (adjustment === 0) continue;
        push({
            ...base,
            counted_qty: counted,
            shown_variance: counted - line.snapshot_qty,
            adjustment_qty: adjustment,
            unit_cost: adjustment > 0 ? line.unit_cost : null,
            serial_numbers: [],
        });
    }

    const locations = [...byLocation.entries()]
        .sort(([a], [b]) => a - b)
        .map(([location_id, planLines]) => ({ location_id, lines: planLines }));
    const totalLines = locations.reduce((n, l) => n + l.lines.length, 0);

    return {
        locations,
        dropped_serials: droppedSerials,
        foreign_serials: foreignSerials,
        uncounted_lines: uncounted,
        total_adjustment_lines: totalLines,
        has_variance: totalLines > 0,
    };
}
