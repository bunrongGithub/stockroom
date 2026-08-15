'use client';

import {
    describeConversion,
    toBaseFactor,
    toBaseQty,
    trimNumber,
    type ConversionType,
} from '@/service/core/uom-conversion';
import { ArrowRight } from 'lucide-react';

/**
 * The plain-language statement of a conversion.
 *
 * "Multiply" and "Divide" mean nothing to a storekeeper, so every place a
 * conversion is entered or chosen shows the relationship in words instead:
 *
 *   MULTIPLY 10  →  "1 Box = 10 Piece"
 *   DIVIDE   10  →  "10 Piece = 1 Box"
 */
export function UomConversionPreview({
    conversion,
    conversionType,
    uomName,
    baseUomName,
    invalid,
}: {
    conversion: number;
    conversionType: ConversionType;
    uomName: string;
    baseUomName: string;
    /** Render as an error when the conversion is not usable. */
    invalid?: boolean;
}) {
    if (invalid || !Number.isFinite(conversion) || conversion <= 0) {
        return (
            <span className="text-[11px] text-rose-500">
                Conversion must be greater than zero
            </span>
        );
    }
    if (!uomName || !baseUomName) {
        return (
            <span className="text-[11px] text-slate-400">
                Select a unit to see the conversion
            </span>
        );
    }
    return (
        <span className="text-[11px] font-semibold text-[#1a9e52]">
            {describeConversion(
                conversion,
                conversionType,
                uomName,
                baseUomName,
            )}
        </span>
    );
}

/**
 * "5 Box = 60 Piece" beside a transaction quantity input.
 *
 * Shown wherever a line is entered in a non-base unit, so the person typing can
 * see the stock effect before they save it.
 */
export function QuantityInBase({
    quantity,
    conversion,
    conversionType = 'MULTIPLY',
    uomName,
    baseUomName,
}: {
    quantity: number;
    conversion: number;
    conversionType?: ConversionType;
    uomName: string;
    baseUomName: string;
}) {
    if (
        !Number.isFinite(quantity) ||
        quantity <= 0 ||
        !Number.isFinite(conversion) ||
        conversion <= 0
    ) {
        return null;
    }
    // Nothing to say when the line is already in the base unit.
    const factor = toBaseFactor(conversion, conversionType);
    if (factor === 1) return null;

    const base = toBaseQty(quantity, {
        itemUomId: null,
        uomId: null,
        baseFactor: factor,
    });

    return (
        <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
            {uomName}
        </span>
    );
}
