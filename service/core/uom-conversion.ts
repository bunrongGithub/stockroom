/**
 * UOM conversion — the single seam every inventory module converts through.
 *
 * Quantities exist in two denominations and the distinction is load-bearing:
 *
 *   entered_qty  what the user typed, in the transaction UOM ("10 Box")
 *   base_qty     the same quantity in the item's base UOM ("120 Piece")
 *
 * Only `base_qty` is arithmetic. Balances, availability, valuation and variance
 * all read it; `entered_qty` exists so a document can be shown back the way it
 * was captured. `inventory_balances.qty_on_hand` carries no UOM column and is
 * ALWAYS base.
 *
 * Before this module the conversion lived in three places with three different
 * behaviours (shipment multiplied by the live factor, adjustment did not convert
 * at all, receipt stored a factor hardcoded to 1). Nothing may re-derive it:
 * `MovementRepository.createMovement()` computes `base_qty` itself from the
 * context returned here, so a caller cannot express the wrong thing.
 *
 * Pure data + arithmetic — no server imports, safe in client components.
 */

/** How an item UOM's `conversion` relates its unit to the item's base unit. */
export type ConversionType = 'MULTIPLY' | 'DIVIDE';

export const CONVERSION_TYPES = ['MULTIPLY', 'DIVIDE'] as const;

/** Quantity columns are numeric(18,6); conversion rounds to the same scale. */
export const QTY_SCALE = 6;

/**
 * The conversion context a transaction line carries.
 *
 * `baseFactor` is canonical: base = entered × baseFactor, whichever type the
 * row was authored with. Resolving the enum away at the edge means no module
 * ever branches on MULTIPLY/DIVIDE — there is one multiplication in the system.
 */
export type UomContext = {
    /** inventory_item_uom.id the line was captured against (null = base). */
    itemUomId: number | null;
    /** inventory_uom.id — what the movement ledger's *_uom_id columns store. */
    uomId: number | null;
    /** base = entered × baseFactor. Always > 0. */
    baseFactor: number;
};

/** A base-UOM context: entered and base are the same denomination. */
export function baseUomContext(uomId: number | null = null): UomContext {
    return { itemUomId: null, uomId, baseFactor: 1 };
}

/**
 * Resolve (conversion, conversion_type) to the canonical multiplier.
 *
 *   MULTIPLY  base = entered × conversion   alternate unit is LARGER than base
 *             Box, 10, MULTIPLY  →  1 Box = 10 Piece
 *   DIVIDE    base = entered ÷ conversion   alternate unit is SMALLER than base
 *             Piece, 10, DIVIDE  →  1 Piece = 0.1 Box
 *
 * Mirrors the `base_factor` generated column on inventory_item_uom, so the
 * database and the application can never disagree.
 */
export function toBaseFactor(
    conversion: number,
    type: ConversionType = 'MULTIPLY',
): number {
    if (!Number.isFinite(conversion) || conversion <= 0) {
        throw new UomConversionError(
            `Conversion must be a number greater than zero (received ${conversion}).`,
        );
    }
    return type === 'DIVIDE' ? 1 / conversion : conversion;
}

/** Raised for a conversion that cannot be performed. */
export class UomConversionError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'UomConversionError';
    }
}

/**
 * Move the decimal point by `exp` places without multiplying.
 *
 * `2.675 * 100` is 267.49999999999997 in float64, so a naive scale-and-round
 * loses the half. Re-parsing the decimal literal with a shifted exponent keeps
 * it exact.
 */
function shiftExponent(value: number, exp: number): number {
    const [mantissa, e] = value.toString().split('e');
    return Number(`${mantissa}e${(e ? Number(e) : 0) + exp}`);
}

/**
 * Round half-away-from-zero to the quantity scale, so results fit
 * numeric(18,6) exactly and -2.675 mirrors 2.675.
 */
export function roundQty(value: number, scale: number = QTY_SCALE): number {
    if (!Number.isFinite(value)) {
        throw new UomConversionError(`Quantity is not a finite number.`);
    }
    if (value === 0) return 0;
    const shifted = shiftExponent(Math.abs(value), scale);
    const rounded = Math.round(shifted);
    return Math.sign(value) * shiftExponent(rounded, -scale);
}

/** Transaction UOM quantity → base UOM quantity. */
export function toBaseQty(enteredQty: number, ctx: UomContext): number {
    assertFactor(ctx);
    return roundQty(enteredQty * ctx.baseFactor);
}

/** Base UOM quantity → transaction UOM quantity, for display. */
export function fromBaseQty(baseQty: number, ctx: UomContext): number {
    assertFactor(ctx);
    return roundQty(baseQty / ctx.baseFactor);
}

function assertFactor(ctx: UomContext): void {
    if (!Number.isFinite(ctx.baseFactor) || ctx.baseFactor <= 0) {
        throw new UomConversionError(
            `Invalid UOM conversion factor (${ctx.baseFactor}).`,
        );
    }
}

/** The shape a persisted item UOM row exposes to the conversion layer. */
export type ItemUomLike = {
    id: number;
    /** Absent when only the factor was selected (e.g. a batch factor lookup). */
    uom_id?: number | null;
    conversion?: number | null;
    conversion_type?: string | null;
    /** Generated column; authoritative when present. */
    base_factor?: number | null;
    is_default?: boolean | null;
};

/** The shape a transaction line exposes to the conversion layer. */
export type UomLineLike = {
    item_uom_id?: number | null;
    /** Factor captured when the line was saved. */
    conversion_factor?: number | null;
};

/**
 * Resolve the context to convert a line with.
 *
 * The line's own `conversion_factor` SNAPSHOT wins over the item's live row.
 * That is what keeps history correct: a receipt of 10 Box captured when a Box
 * was 10 Piece stays 100 Piece after someone edits the item to 12, because the
 * line remembers the 10. The live row is a fallback only for rows written
 * before the snapshot column existed — all of which are legitimately 1.
 */
export function uomContextOf(
    line: UomLineLike,
    itemUom?: ItemUomLike | null,
): UomContext {
    const snapshot = line.conversion_factor;
    const hasSnapshot =
        snapshot !== null && snapshot !== undefined && Number(snapshot) > 0;

    return {
        itemUomId: line.item_uom_id ?? itemUom?.id ?? null,
        uomId: itemUom?.uom_id ?? null,
        baseFactor: hasSnapshot
            ? Number(snapshot)
            : itemUomBaseFactor(itemUom),
    };
}

/** The canonical factor for an item UOM row, tolerating older/partial rows. */
export function itemUomBaseFactor(itemUom?: ItemUomLike | null): number {
    if (!itemUom) return 1;
    if (itemUom.base_factor != null && Number(itemUom.base_factor) > 0) {
        return Number(itemUom.base_factor);
    }
    const conversion = Number(itemUom.conversion ?? 1);
    if (!Number.isFinite(conversion) || conversion <= 0) return 1;
    return toBaseFactor(
        conversion,
        (itemUom.conversion_type as ConversionType) ?? 'MULTIPLY',
    );
}

/**
 * A serial number identifies one BASE unit, so a serial-tracked line must
 * resolve to a whole number of base units. Receiving 10 Box at 12 Piece needs
 * 120 serials; entering 5 Piece against a Box base (0.5 Box) is meaningless and
 * is rejected here rather than producing half a tracked unit.
 */
export function assertWholeBaseQty(baseQty: number, label = 'this item'): void {
    if (!Number.isInteger(roundQty(baseQty))) {
        throw new UomConversionError(
            `${label} is serial tracked, so the quantity must convert to a whole number of base units (got ${baseQty}).`,
        );
    }
}

/**
 * Human-readable statement of a conversion, for the editor and line pickers.
 * Users must never have to reason about the enum.
 *
 *   MULTIPLY 10  →  "1 Box = 10 Piece"
 *   DIVIDE   10  →  "10 Piece = 1 Box"
 */
export function describeConversion(
    conversion: number,
    type: ConversionType,
    uomName: string,
    baseUomName: string,
): string {
    const n = trimNumber(conversion);
    return type === 'DIVIDE'
        ? `${n} ${uomName} = 1 ${baseUomName}`
        : `1 ${uomName} = ${n} ${baseUomName}`;
}

/** Drop trailing zeros so "10.000000" reads as "10". */
export function trimNumber(value: number): string {
    if (!Number.isFinite(value)) return String(value);
    return String(roundQty(value));
}
