import assert from 'node:assert/strict';
import test from 'node:test';
import {
    buildAdjustmentPlan,
    bucketKey,
    classifyScannedSerials,
    computeCountActions,
    type CountLineInput,
    type LineSerialSets,
} from '../service/apps/inventory/repo/stock-count-logic.ts';

// ── State machine ───────────────────────────────────────────────────────────

test('computeCountActions maps each status to its allowed actions', () => {
    assert.deepEqual(computeCountActions('DRAFT'), {
        can_update: true,
        can_delete: true,
        can_prepare: true,
        can_start: false,
        can_count: false,
        can_complete: false,
        can_cancel: true,
    });
    assert.equal(computeCountActions('PREPARED').can_start, true);
    assert.equal(computeCountActions('COUNTING').can_count, true);
    // Completing is the only way out of COUNTING — there is no approval gate.
    assert.equal(computeCountActions('COUNTING').can_complete, true);
    for (const status of ['COMPLETED', 'CANCELLED'] as const) {
        const actions = computeCountActions(status);
        assert.ok(
            Object.values(actions).every((allowed) => allowed === false),
            `${status} must be terminal`,
        );
    }
});

// ── Serial classification ───────────────────────────────────────────────────

const bucket = { item_id: 7, warehouse_id: 1, location_id: 2 };

test('classifyScannedSerials: expected → matched, unknown → new', () => {
    const result = classifyScannedSerials(
        ['SN-1', 'SN-9'],
        new Set(['SN-1']),
        new Map(),
        bucket,
    );
    assert.deepEqual(result.accepted, [
        { serial_number: 'SN-1', classification: 'matched' },
        { serial_number: 'SN-9', classification: 'new' },
    ]);
    assert.equal(result.rejected.length, 0);
});

test('classifyScannedSerials: existing same-item elsewhere → foreign', () => {
    const result = classifyScannedSerials(
        ['SN-2'],
        new Set(),
        new Map([
            ['SN-2', { item_id: 7, warehouse_id: 9, location_id: 4, status: 'available' }],
        ]),
        bucket,
    );
    assert.deepEqual(result.accepted, [
        { serial_number: 'SN-2', classification: 'foreign' },
    ]);
});

test('classifyScannedSerials: same-bucket but non-available status → foreign', () => {
    // e.g. a serial the ERP thinks is sold, physically still on the shelf
    const result = classifyScannedSerials(
        ['SN-3'],
        new Set(),
        new Map([
            ['SN-3', { item_id: 7, warehouse_id: 1, location_id: 2, status: 'sold' }],
        ]),
        bucket,
    );
    assert.equal(result.accepted[0].classification, 'foreign');
});

test('classifyScannedSerials: other item → rejected wrong_item', () => {
    const result = classifyScannedSerials(
        ['SN-4'],
        new Set(),
        new Map([
            ['SN-4', { item_id: 99, warehouse_id: 1, location_id: 2, status: 'available' }],
        ]),
        bucket,
    );
    assert.equal(result.accepted.length, 0);
    assert.deepEqual(result.rejected, [
        { serial_number: 'SN-4', reason: 'wrong_item' },
    ]);
});

test('classifyScannedSerials dedupes and trims input', () => {
    const result = classifyScannedSerials(
        [' SN-1 ', 'SN-1', '', 'SN-1'],
        new Set(['SN-1']),
        new Map(),
        bucket,
    );
    assert.equal(result.accepted.length, 1);
});

// ── Adjustment plan ─────────────────────────────────────────────────────────

const line = (over: Partial<CountLineInput>): CountLineInput => ({
    line_id: 1,
    item_id: 10,
    location_id: 1,
    item_uom_id: null,
    is_serial: false,
    snapshot_qty: 10,
    counted_qty: 10,
    unit_cost: 5,
    ...over,
});

const live = (entries: [number, number, number][]) =>
    new Map(entries.map(([item, loc, qty]) => [bucketKey(item, loc), qty]));

test('variance signs: over → IN with cost, short → OUT without cost, exact → no line', () => {
    const plan = buildAdjustmentPlan(
        [
            line({ line_id: 1, item_id: 10, counted_qty: 12 }), // +2
            line({ line_id: 2, item_id: 11, counted_qty: 7 }), // −3
            line({ line_id: 3, item_id: 12, counted_qty: 10 }), // 0
        ],
        live([
            [10, 1, 10],
            [11, 1, 10],
            [12, 1, 10],
        ]),
        new Map(),
        'ignore',
    );
    assert.equal(plan.locations.length, 1);
    const [a, b] = plan.locations[0].lines;
    assert.equal(a.adjustment_qty, 2);
    assert.equal(a.unit_cost, 5);
    assert.equal(b.adjustment_qty, -3);
    assert.equal(b.unit_cost, null);
    assert.equal(plan.total_adjustment_lines, 2);
    assert.equal(plan.has_variance, true);
});

test('adjustment targets LIVE qty; drift is flagged; shown variance stays vs snapshot', () => {
    // snapshot said 10, user counted 10, but 4 were shipped mid-count (live 6)
    const plan = buildAdjustmentPlan(
        [line({ counted_qty: 10 })],
        live([[10, 1, 6]]),
        new Map(),
        'ignore',
    );
    const planned = plan.locations[0].lines[0];
    assert.equal(planned.adjustment_qty, 4); // 10 − live 6
    assert.equal(planned.shown_variance, 0); // 10 − snapshot 10
    assert.equal(planned.drift, true);
});

test("policy 'ignore' skips uncounted lines; 'zero' adjusts them to zero", () => {
    const rows = [line({ counted_qty: null })];
    const state = live([[10, 1, 10]]);

    const ignored = buildAdjustmentPlan(rows, state, new Map(), 'ignore');
    assert.equal(ignored.total_adjustment_lines, 0);
    assert.equal(ignored.uncounted_lines, 1);

    const zeroed = buildAdjustmentPlan(rows, state, new Map(), 'zero');
    assert.equal(zeroed.locations[0].lines[0].adjustment_qty, -10);
    assert.equal(zeroed.uncounted_lines, 1);
});

test('lines group into one adjustment per location, sorted', () => {
    const plan = buildAdjustmentPlan(
        [
            line({ line_id: 1, item_id: 10, location_id: 5, counted_qty: 11 }),
            line({ line_id: 2, item_id: 10, location_id: 2, counted_qty: 12 }),
            line({ line_id: 3, item_id: 11, location_id: 5, counted_qty: 8 }),
        ],
        live([
            [10, 5, 10],
            [10, 2, 10],
            [11, 5, 10],
        ]),
        new Map(),
        'ignore',
    );
    assert.deepEqual(
        plan.locations.map((l) => l.location_id),
        [2, 5],
    );
    assert.equal(plan.locations[1].lines.length, 2);
});

test('serial line with missing and new serials emits two lines (OUT then IN)', () => {
    const sets = new Map<number, LineSerialSets>([
        [
            1,
            {
                missing: ['SN-A', 'SN-B'],
                dropped: [],
                added: ['SN-X'],
                foreign: [],
            },
        ],
    ]);
    const plan = buildAdjustmentPlan(
        [line({ is_serial: true, snapshot_qty: 3, counted_qty: 2 })],
        live([[10, 1, 3]]),
        sets,
        'ignore',
    );
    const [out, incoming] = plan.locations[0].lines;
    assert.equal(out.adjustment_qty, -2);
    assert.deepEqual(out.serial_numbers, ['SN-A', 'SN-B']);
    assert.equal(out.unit_cost, null);
    assert.equal(incoming.adjustment_qty, 1);
    assert.deepEqual(incoming.serial_numbers, ['SN-X']);
    assert.equal(incoming.unit_cost, 5);
});

test('dropped and foreign serials are excluded from lines but reported', () => {
    const sets = new Map<number, LineSerialSets>([
        [
            1,
            {
                missing: [],
                dropped: ['SN-GONE'],
                added: [],
                foreign: ['SN-ELSEWHERE'],
            },
        ],
    ]);
    const plan = buildAdjustmentPlan(
        [line({ is_serial: true, counted_qty: 10 })],
        live([[10, 1, 10]]),
        sets,
        'ignore',
    );
    assert.equal(plan.total_adjustment_lines, 0);
    assert.equal(plan.has_variance, false);
    assert.deepEqual(plan.dropped_serials, [
        { line_id: 1, serial_number: 'SN-GONE' },
    ]);
    assert.deepEqual(plan.foreign_serials, [
        { line_id: 1, serial_number: 'SN-ELSEWHERE' },
    ]);
});

test('serial line balanced in and out still adjusts both sides (net zero)', () => {
    const sets = new Map<number, LineSerialSets>([
        [1, { missing: ['SN-A'], dropped: [], added: ['SN-B'], foreign: [] }],
    ]);
    const plan = buildAdjustmentPlan(
        [line({ is_serial: true, snapshot_qty: 5, counted_qty: 5 })],
        live([[10, 1, 5]]),
        sets,
        'ignore',
    );
    assert.equal(plan.total_adjustment_lines, 2);
    const qtys = plan.locations[0].lines.map((l) => l.adjustment_qty);
    assert.deepEqual(qtys.sort(), [-1, 1]);
});

test('missing bucket in live map is treated as zero on-hand', () => {
    const plan = buildAdjustmentPlan(
        [line({ counted_qty: 4, snapshot_qty: 0 })],
        new Map(),
        new Map(),
        'ignore',
    );
    assert.equal(plan.locations[0].lines[0].adjustment_qty, 4);
    assert.equal(plan.locations[0].lines[0].live_qty, 0);
});
