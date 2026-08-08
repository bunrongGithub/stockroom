'use client';

import AsyncSearchSelect from '@/components/ui/AsyncSearchSelect';
import { EditableInput, EditableSelect, FieldLabel } from '@/components/ui/FieldLabel';
import { ReadonlyInput } from '@/components/ui/Readonly';
import { UomConversionPreview } from '@/components/ui/UomConversionPreview';
import { API } from '@/lib/constant';
import type { ConversionType } from '@/service/core/uom-conversion';
import { AlertCircle, Plus, Ruler, Trash2 } from 'lucide-react';

/** One editable row in the UOM Details table. */
export type ItemUomDraft = {
    key: string;
    /** inventory_item_uom.id when the row already exists. */
    id?: number;
    uom_id: number | null;
    uom_name: string;
    conversion: number;
    conversion_type: ConversionType;
    /** True for the item's base UOM, which is shown but not editable here. */
    is_default?: boolean;
    /** Set when the row is referenced by documents and cannot be removed. */
    locked?: boolean;
};

let keySeq = 0;
export function emptyUomRow(): ItemUomDraft {
    return {
        key: `u${keySeq++}`,
        uom_id: null,
        uom_name: '',
        conversion: 1,
        conversion_type: 'MULTIPLY',
    };
}

/**
 * The UOM Details editor.
 *
 * Defines the units an item may be transacted in besides its base unit. The
 * base UOM is shown read-only at the top — it is owned by the Details tab and
 * is always 1 — and is excluded from the picker so it cannot be re-added.
 *
 * Every row previews its own conversion in words, because "Multiply" and
 * "Divide" are not self-explanatory: 1 Box = 10 Piece.
 */
export default function ItemUomDetails({
    baseUomName,
    rows,
    onChangeAction,
}: {
    baseUomName: string;
    rows: ItemUomDraft[];
    onChangeAction: (next: ItemUomDraft[]) => void;
}) {
    // The base row lives in the header, not the table.
    const details = rows.filter((r) => !r.is_default);
    function patch(key: string, next: Partial<ItemUomDraft>) {
        onChangeAction(
            rows.map((r) => (r.key === key ? { ...r, ...next } : r)),
        );
    }

    function remove(key: string) {
        onChangeAction(rows.filter((r) => r.key !== key));
    }

    return (
        <div className="space-y-4">
            {/* Base UOM — context for every conversion below it. */}
            <div className="grid gap-4 lg:grid-cols-2">
                <div>
                    <FieldLabel>Base UOM</FieldLabel>
                    <ReadonlyInput
                        value={baseUomName}
                        placeholder="Set the base UOM on the Details tab"
                    />
                </div>
                <div>
                    <FieldLabel>Stock is counted in</FieldLabel>
                    <div className="flex min-h-11.5 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-600">
                        <Ruler size={13} className="shrink-0 text-[#1a9e52]" />
                        {baseUomName
                            ? `1 ${baseUomName} = 1 ${baseUomName}`
                            : '—'}
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Additional Units ({details.length})
                </span>
                <button
                    type="button"
                    onClick={() => onChangeAction([...rows, emptyUomRow()])}
                    disabled={!baseUomName}
                    className="inline-flex items-center gap-1 rounded-lg bg-[#1a9e52] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#158042] disabled:opacity-50"
                >
                    <Plus size={12} /> Add UOM
                </button>
            </div>

            {!baseUomName && (
                <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                    <p>
                        Choose a Base UOM on the Details tab first — every
                        conversion is expressed relative to it.
                    </p>
                </div>
            )}

            {baseUomName && details.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-slate-400">
                    Only {baseUomName} for now. Add a unit to buy or sell this
                    item by the Box, Carton or Pack.
                </p>
            ) : (
                <div className="space-y-3">
                    {details.map((row) => {
                        const duplicate =
                            row.uom_id != null &&
                            rows.filter((r) => r.uom_id === row.uom_id).length >
                                1;
                        return (
                            <div
                                key={row.key}
                                className="space-y-3 rounded-xl border border-slate-200 p-3"
                            >
                                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.2fr)_auto]">
                                    <div>
                                        {/* The base UOM and any already-used
                                            unit are filtered out client-side so
                                            a clash cannot be selected at all. */}
                                        <AsyncSearchSelect
                                            label="UOM"
                                            required
                                            placeholder="Select unit..."
                                            apiUrl={`${API.inventory.uom.root}?status=active`}
                                            value={row.uom_id}
                                            selectedLabel={row.uom_name}
                                            enablePopupSearch
                                            onChangeAction={(sel) =>
                                                patch(row.key, {
                                                    uom_id: sel?.id
                                                        ? Number(sel.id)
                                                        : null,
                                                    uom_name: sel?.name ?? '',
                                                })
                                            }
                                        />
                                    </div>
                                    <div>
                                        <FieldLabel required>
                                            Conversion
                                        </FieldLabel>
                                        <EditableInput
                                            type="number"
                                            min={0}
                                            step="0.000001"
                                            value={row.conversion}
                                            onChange={(e) =>
                                                patch(row.key, {
                                                    conversion: Number(
                                                        e.target.value,
                                                    ),
                                                })
                                            }
                                        />
                                    </div>
                                    <div>
                                        <FieldLabel>Type</FieldLabel>
                                        <EditableSelect
                                            value={row.conversion_type}
                                            onChange={(e) =>
                                                patch(row.key, {
                                                    conversion_type: e.target
                                                        .value as ConversionType,
                                                })
                                            }
                                        >
                                            <option value="MULTIPLY">
                                                Multiply — larger than base
                                            </option>
                                            <option value="DIVIDE">
                                                Divide — smaller than base
                                            </option>
                                        </EditableSelect>
                                    </div>
                                    <div className="flex items-end">
                                        <button
                                            type="button"
                                            onClick={() => remove(row.key)}
                                            disabled={row.locked}
                                            title={
                                                row.locked
                                                    ? 'Used by existing documents — cannot be removed'
                                                    : 'Remove this UOM'
                                            }
                                            className="mb-0.5 h-11.5 w-11.5 shrink-0 rounded-xl border border-rose-200 text-rose-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                            <Trash2
                                                size={14}
                                                className="mx-auto"
                                            />
                                        </button>
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <UomConversionPreview
                                        conversion={row.conversion}
                                        conversionType={row.conversion_type}
                                        uomName={row.uom_name}
                                        baseUomName={baseUomName}
                                    />
                                    {duplicate && (
                                        <span className="text-[11px] text-rose-500">
                                            This unit is already defined for the
                                            item
                                        </span>
                                    )}
                                    {row.locked && (
                                        <span className="text-[11px] text-slate-400">
                                            Used by existing documents — the
                                            unit cannot be changed
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <p className="text-[11px] leading-relaxed text-slate-400">
                Stock is always held in {baseUomName || 'the base UOM'}. A
                transaction entered in another unit is converted on save, and the
                conversion used is stored on the document — changing a
                conversion later never restates past transactions.
            </p>
        </div>
    );
}

/** Validate the editor's rows before submitting. Returns an error or null. */
export function validateUomRows(rows: ItemUomDraft[]): string | null {
    const details = rows.filter((r) => !r.is_default);
    const seen = new Set<number>();
    for (const row of details) {
        if (!row.uom_id) return 'Select a unit for every UOM row.';
        if (seen.has(row.uom_id)) {
            return 'The same unit cannot be added twice to an item.';
        }
        seen.add(row.uom_id);
        if (!Number.isFinite(row.conversion) || row.conversion <= 0) {
            return 'Every conversion must be greater than zero.';
        }
    }
    const base = rows.find((r) => r.is_default);
    if (base?.uom_id && seen.has(base.uom_id)) {
        return 'The base UOM cannot also appear under Additional Units.';
    }
    return null;
}
