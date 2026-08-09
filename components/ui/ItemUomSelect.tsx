'use client';

import { EditableSelect, FieldLabel } from '@/components/ui/FieldLabel';
import { ReadonlyInput } from '@/components/ui/Readonly';
import { API } from '@/lib/constant';
import {
    itemUomBaseFactor,
    type ConversionType,
} from '@/service/core/uom-conversion';
import { useEffect, useState } from 'react';

/** One selectable transaction unit for an item. */
export type ItemUomOption = {
    /** inventory_item_uom.id — what a line's `item_uom_id` stores. */
    id: number;
    uomId: number;
    name: string;
    conversion: number;
    conversionType: ConversionType;
    /** base_qty = entered_qty × baseFactor. */
    baseFactor: number;
    isDefault: boolean;
};

/** What the caller needs when a unit is chosen. */
export type ItemUomSelection = {
    itemUomId: number | null;
    name: string;
    baseFactor: number;
};

const cache = new Map<number, ItemUomOption[]>();

/** Fetch (and memoise) an item's transaction units. */
export async function fetchItemUoms(itemId: number): Promise<ItemUomOption[]> {
    const hit = cache.get(itemId);
    if (hit) return hit;

    const res = await fetch(
        `${API.inventory.itemUom.root}?item_id=${itemId}&limit=100`,
    );
    const json = await res.json();
    const rows = (json.data ?? []) as Array<{
        id: number;
        uom_id: number;
        name: string;
        conversion: number | null;
        conversion_type: ConversionType | null;
        base_factor: number | null;
        is_default: boolean;
        uom?: { name?: string } | null;
    }>;

    const options = rows.map((r) => ({
        id: r.id,
        uomId: r.uom_id,
        name: r.uom?.name ?? '',
        conversion: Number(r.conversion ?? 1),
        conversionType: (r.conversion_type ?? 'MULTIPLY') as ConversionType,
        baseFactor: itemUomBaseFactor(r),
        isDefault: Boolean(r.is_default),
    }));
    cache.set(itemId, options);
    return options;
}

/** Drop an item's cached units after its UOM Details are edited. */
export function clearItemUomCache(itemId?: number) {
    if (itemId) cache.delete(itemId);
    else cache.clear();
}

/** The base unit of a loaded option list. */
export function baseOptionOf(options: ItemUomOption[]) {
    return options.find((o) => o.isDefault) ?? options[0] ?? null;
}

/**
 * Transaction unit picker for a document line.
 *
 * The item's base UOM is preselected — that is the existing behaviour and it
 * stays — but any other unit the item defines can now be chosen. Options show
 * the unit name alone; the conversion is surfaced by QuantityInBase next to
 * the quantity field rather than crammed into the option text.
 *
 * Renders a plain read-only field when the item has only its base unit, so
 * nothing changes for items that were never given alternates.
 */
export default function ItemUomSelect({
    itemId,
    value,
    label = 'UOM',
    required,
    disabled,
    onChangeAction,
}: {
    itemId: number | null;
    /** Current inventory_item_uom.id on the line. */
    value: number | null;
    label?: string;
    required?: boolean;
    disabled?: boolean;
    onChangeAction: (selection: ItemUomSelection) => void;
}) {
    // Options are stored WITH the item they belong to, so switching products
    // can never render the previous item's units — and both `options` and
    // `loading` derive from that one value rather than being set synchronously
    // inside the effect.
    const [loaded, setLoaded] = useState<{
        itemId: number;
        options: ItemUomOption[];
    } | null>(null);

    const fresh = loaded?.itemId === itemId;
    const options = fresh ? loaded.options : [];
    const loading = itemId != null && !fresh;

    useEffect(() => {
        if (!itemId) return;
        let active = true;
        fetchItemUoms(itemId)
            .then((opts) => {
                if (!active) return;
                setLoaded({ itemId, options: opts });
                // Default to base only when the line has no unit yet, so an
                // existing document keeps whatever it was saved with.
                if (value == null) {
                    const base = baseOptionOf(opts);
                    if (base) {
                        onChangeAction({
                            itemUomId: base.id,
                            name: base.name,
                            baseFactor: base.baseFactor,
                        });
                    }
                }
            })
            .catch(() => active && setLoaded({ itemId, options: [] }));
        return () => {
            active = false;
        };
        // onChangeAction is intentionally omitted: callers pass a fresh closure
        // each render and re-running this would loop.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [itemId]);

    if (!itemId) {
        return (
            <div>
                <FieldLabel required={required}>{label}</FieldLabel>
                <ReadonlyInput placeholder="Select a product first" />
            </div>
        );
    }

    const selected = options.find((o) => o.id === value) ?? null;
    const base = baseOptionOf(options);

    // Nothing to choose from — show the unit rather than an inert dropdown.
    if (!loading && options.length <= 1) {
        return (
            <div>
                <FieldLabel required={required}>{label}</FieldLabel>
                <ReadonlyInput
                    value={selected?.name ?? base?.name ?? ''}
                    placeholder="—"
                />
            </div>
        );
    }

    return (
        <div>
            <FieldLabel required={required}>{label}</FieldLabel>
            <EditableSelect
                value={value != null ? String(value) : ''}
                disabled={disabled || loading}
                onChange={(e) => {
                    const picked = options.find(
                        (o) => String(o.id) === e.target.value,
                    );
                    if (!picked) return;
                    onChangeAction({
                        itemUomId: picked.id,
                        name: picked.name,
                        baseFactor: picked.baseFactor,
                    });
                }}
            >
                {value == null && <option value="">Select UOM…</option>}
                {/* Just the unit name. The conversion used to be spelled out
                    here ("Pack — 1 Pack = 6 Bottle"), which made the closed
                    select too wide to read. It is still shown where it is
                    actually needed: the QuantityInBase hint under the quantity
                    field, which reads the entered qty back in base units. */}
                {options.map((o) => (
                    <option key={o.id} value={String(o.id)}>
                        {o.name}
                    </option>
                ))}
            </EditableSelect>
        </div>
    );
}
