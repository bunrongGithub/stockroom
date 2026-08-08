import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    assertWholeBaseQty,
    baseUomContext,
    describeConversion,
    fromBaseQty,
    itemUomBaseFactor,
    roundQty,
    toBaseFactor,
    toBaseQty,
    uomContextOf,
    UomConversionError,
} from '../service/core/uom-conversion.ts';

// UOM conversion is the single seam every inventory module converts through.
// Before it existed, shipment multiplied by the live factor, adjustment did not
// convert at all, and receipt stored a factor hardcoded to 1. These tests pin
// the one behaviour they must now share.

// ── The canonical factor ────────────────────────────────────────────────────

test('MULTIPLY means the alternate unit is larger than base', () => {
    // 1 Box = 10 Piece
    assert.equal(toBaseFactor(10, 'MULTIPLY'), 10);
    assert.equal(toBaseQty(10, ctx(10, 'MULTIPLY')), 100);
});

test('DIVIDE means the alternate unit is smaller than base', () => {
    // 1 Piece = 0.1 Box
    assert.equal(toBaseFactor(10, 'DIVIDE'), 0.1);
    assert.equal(toBaseQty(10, ctx(10, 'DIVIDE')), 1);
});

test('MULTIPLY is the default when no type is given', () => {
    assert.equal(toBaseFactor(12), 12);
});

test('conversion must be greater than zero', () => {
    for (const bad of [0, -1, -0.5, NaN, Infinity]) {
        assert.throws(() => toBaseFactor(bad), UomConversionError, `${bad}`);
    }
});

test('a zero or negative factor cannot be converted with', () => {
    assert.throws(
        () => toBaseQty(5, { itemUomId: 1, uomId: 1, baseFactor: 0 }),
        UomConversionError,
    );
    assert.throws(
        () => fromBaseQty(5, { itemUomId: 1, uomId: 1, baseFactor: -2 }),
        UomConversionError,
    );
});

// ── Decimals and rounding ───────────────────────────────────────────────────

test('rounds to the numeric(18,6) scale', () => {
    assert.equal(roundQty(1.23456749), 1.234567);
    assert.equal(roundQty(1.2345675), 1.234568);
});

test('rounds half-up despite binary representation', () => {
    // 2.675 is really 2.67499999… in float64.
    assert.equal(roundQty(2.675, 2), 2.68);
    assert.equal(roundQty(1.005, 2), 1.01);
});

test('decimal conversions convert exactly at 6dp', () => {
    // A dozen-and-a-half: 1 unit = 1.5 base
    assert.equal(toBaseQty(3, ctx(1.5)), 4.5);
    // Thirds are irrational in base 10 — the scale caps them.
    assert.equal(toBaseQty(1, ctx(3, 'DIVIDE')), 0.333333);
});

test('negative quantities keep their sign through rounding', () => {
    assert.equal(toBaseQty(-10, ctx(12)), -120);
    assert.equal(roundQty(-2.675, 2), -2.68);
});

// ── Round trip ──────────────────────────────────────────────────────────────

test('fromBaseQty inverts toBaseQty', () => {
    for (const [qty, conv] of [
        [10, 12],
        [3, 1.5],
        [7, 6],
        [250, 1000],
    ] as const) {
        const c = ctx(conv);
        assert.equal(fromBaseQty(toBaseQty(qty, c), c), qty);
    }
});

test('a base context is the identity', () => {
    const c = baseUomContext(4);
    assert.equal(toBaseQty(37, c), 37);
    assert.equal(fromBaseQty(37, c), 37);
    assert.equal(c.uomId, 4);
});

// ── Snapshot beats live row (the historical guarantee) ──────────────────────

test('a line prefers its captured conversion_factor over the live item row', () => {
    // Captured yesterday when a Box was 10 Piece…
    const line = { item_uom_id: 5, conversion_factor: 10 };
    // …the item was edited to 12 today.
    const live = { id: 5, uom_id: 2, conversion: 12, conversion_type: 'MULTIPLY' };

    const resolved = uomContextOf(line, live);
    assert.equal(resolved.baseFactor, 10, 'snapshot wins');
    assert.equal(toBaseQty(10, resolved), 100, 'still 100, not 120');
});

test('a line with no snapshot falls back to the live row', () => {
    const resolved = uomContextOf(
        { item_uom_id: 5 },
        { id: 5, uom_id: 2, conversion: 12, conversion_type: 'MULTIPLY' },
    );
    assert.equal(resolved.baseFactor, 12);
});

test('a zero snapshot is ignored rather than trusted', () => {
    const resolved = uomContextOf(
        { item_uom_id: 5, conversion_factor: 0 },
        { id: 5, uom_id: 2, conversion: 6, conversion_type: 'MULTIPLY' },
    );
    assert.equal(resolved.baseFactor, 6);
});

test('a line with neither snapshot nor row converts 1:1', () => {
    const resolved = uomContextOf({ item_uom_id: null });
    assert.equal(resolved.baseFactor, 1);
    assert.equal(toBaseQty(9, resolved), 9);
});

test('the generated base_factor column is authoritative when present', () => {
    // Row says DIVIDE 10 but the stored generated column says 0.1 — same thing;
    // the column is used directly rather than recomputed.
    assert.equal(
        itemUomBaseFactor({
            id: 1,
            uom_id: 2,
            conversion: 10,
            conversion_type: 'DIVIDE',
            base_factor: 0.1,
        }),
        0.1,
    );
});

test('a corrupt live row degrades to 1 rather than throwing mid-post', () => {
    assert.equal(itemUomBaseFactor({ id: 1, uom_id: 2, conversion: 0 }), 1);
    assert.equal(itemUomBaseFactor({ id: 1, uom_id: 2, conversion: null }), 1);
    assert.equal(itemUomBaseFactor(null), 1);
});

// ── Serial tracking ─────────────────────────────────────────────────────────

test('serial-tracked lines must resolve to whole base units', () => {
    // 10 Box × 12 = 120 serials — fine.
    assertWholeBaseQty(toBaseQty(10, ctx(12)));
    // 5 Piece against a Box base = 0.5 Box — impossible to serialise.
    assert.throws(
        () => assertWholeBaseQty(toBaseQty(5, ctx(10, 'DIVIDE')), 'iPhone'),
        UomConversionError,
    );
});

test('the serial guard names the item so the message is actionable', () => {
    assert.throws(
        () => assertWholeBaseQty(0.5, 'iPhone 16'),
        (e: Error) => e.message.includes('iPhone 16'),
    );
});

// Regression: the serial PANEL asked for the base count while the submit
// VALIDATION compared against the entered count, so a correct selection was
// rejected ("Select exactly 1 serial number(s)" for 1 Piecs = 2 Unit, where 2
// serials had rightly been chosen). Both sides must derive from base.
test('required serial count comes from base quantity, not entered quantity', () => {
    // 1 Piecs where 1 Piecs = 2 Unit → 2 serials, not 1.
    const line = { item_uom_id: 36, conversion_factor: 2 };
    const required = toBaseQty(1, uomContextOf(line));
    assert.equal(required, 2);

    // A base-UOM line is unaffected — the count still equals what was entered.
    assert.equal(toBaseQty(3, uomContextOf({ item_uom_id: 23 })), 3);
});

// ── Human-readable description ──────────────────────────────────────────────

test('MULTIPLY reads as one alternate equals N base', () => {
    assert.equal(describeConversion(10, 'MULTIPLY', 'Box', 'Piece'), '1 Box = 10 Piece');
});

test('DIVIDE reads as N alternate equals one base', () => {
    assert.equal(describeConversion(10, 'DIVIDE', 'Piece', 'Box'), '10 Piece = 1 Box');
});

test('descriptions drop trailing zeros', () => {
    assert.equal(
        describeConversion(1.5, 'MULTIPLY', 'Half', 'Piece'),
        '1 Half = 1.5 Piece',
    );
});

function ctx(conversion: number, type: 'MULTIPLY' | 'DIVIDE' = 'MULTIPLY') {
    return {
        itemUomId: 1,
        uomId: 2,
        baseFactor: toBaseFactor(conversion, type),
    };
}
