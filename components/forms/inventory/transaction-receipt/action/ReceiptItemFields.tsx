'use client';

import AsyncSearchSelect from '@/components/ui/AsyncSearchSelect';
import ItemUomSelect, {
  baseOptionOf,
  fetchItemUoms,
} from '@/components/ui/ItemUomSelect';
import { QuantityInBase } from '@/components/ui/UomConversionPreview';
import SerialEntryPanel from '@/components/ui/serial/SerialEntryPanel';
import { EditableInput, FieldLabel } from '@/components/ui/FieldLabel';
import { API } from '@/lib/constant';
import { useItemAutoFill } from '@/hook/useItemAutoFill';
import { useEffect, useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

export type LineItem = {
  item_id: number | null;
  item_label: string;
  item_uom_id: number | null;
  uom_label: string;
  warehouse_id: number | null;
  warehouse_label: string;
  location_id: number | null;
  location_label: string;
  receipt_qty: number | '';
  unit_cost: number | '';
  lot_number: string;
  purchased_date: string;
  serial_numbers: string[];
};

export const DEFAULT_LINE: LineItem = {
  item_id: null,
  item_label: '',
  item_uom_id: null,
  uom_label: '',
  warehouse_id: null,
  warehouse_label: '',
  location_id: null,
  location_label: '',
  receipt_qty: '',
  unit_cost: '',
  lot_number: '',
  purchased_date: new Date().toISOString().slice(0, 10),
  serial_numbers: [],
};

/**
 * Receipt line-item fields. Reads/writes the surrounding form through
 * `useFormContext`, so it can be dropped into any `FormDialog<LineItem>`.
 *
 * The warehouse is chosen at the receipt level (not inside this modal), so the
 * parent passes it in via `warehouseId` to drive the dependent Location select.
 */
export default function ReceiptItemFields({
  warehouseId: warehouseIdProp,
}: {
  warehouseId?: number | null;
}) {
  const {
    control,
    register,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useFormContext<LineItem>();
  const { resolveItemDefaults } = useItemAutoFill();

  // Prefer the receipt-level warehouse passed from the parent; fall back to the
  // value already stored on the line item (e.g. when editing an existing row).
  const warehouseId = warehouseIdProp ?? watch('warehouse_id');

  // UOM options are scoped to the selected product (item_uom rows).
  const itemId = watch('item_id');
  const serialNumbers = watch('serial_numbers') ?? [];
  const receiptQty = Number(watch('receipt_qty') || 0);
  // base_qty = receipt_qty × baseFactor. 1 until a non-base unit is picked, so
  // receipts of items with only a base UOM behave exactly as before.
  // Stored WITH the item it describes, so a product switch can never render
  // the previous item's conversion or serial flag, and nothing has to be reset
  // synchronously inside the effect below.
  const [meta, setMeta] = useState<{
    itemId: number;
    baseFactor: number;
    baseUomName: string;
    serialEnabled: boolean;
    serialGeneration: 'manual' | 'auto' | 'both';
  } | null>(null);

  const fresh = meta != null && meta.itemId === itemId;
  const baseFactor = fresh ? meta.baseFactor : 1;
  const baseUomName = fresh ? meta.baseUomName : '';
  const serialEnabled = fresh ? meta.serialEnabled : false;
  const serialGeneration = fresh ? meta.serialGeneration : 'both';

  // Recompute the serial-tracking flag whenever the item changes (incl. on
  // mount when editing an existing line). Goes through the cached lookup, so it
  // shares one request with the pick-handler auto-fill below.
  useEffect(() => {
    if (!itemId) {
      setValue('serial_numbers', []);
      return;
    }

    let active = true;

    // Units and item defaults resolve together so the line's conversion and
    // its serial flag are published as one consistent snapshot. Both lookups
    // are cached, so this is not an extra round trip.
    Promise.all([
      fetchItemUoms(itemId).catch(() => []),
      resolveItemDefaults(itemId).catch(() => null),
    ]).then(([uoms, defaults]) => {
      if (!active) return;
      const base = baseOptionOf(uoms);
      const current = uoms.find((u) => u.id === getValues('item_uom_id'));
      setMeta({
        itemId,
        baseUomName: base?.name ?? '',
        baseFactor: (current ?? base)?.baseFactor ?? 1,
        serialEnabled: defaults?.trackSerial ?? false,
        serialGeneration: defaults?.serialGeneration ?? 'both',
      });
      if (!defaults?.trackSerial) setValue('serial_numbers', []);
    });

    return () => {
      active = false;
    };
  }, [itemId, setValue, getValues, resolveItemDefaults]);

  // Auto-populate cost / UOM / location from the item master when the user
  // PICKS a product (not on edit-mount, so saved line values are never
  // clobbered). Preserves qty; defaults location only when empty and valid for
  // the receipt's warehouse.
  async function onPickItem(
    selected: { id: string | number | null; name: string } | null,
  ) {
    const id = selected?.id ? Number(selected.id) : null;
    setValue('item_id', id, { shouldValidate: true });
    setValue('item_label', selected?.name ?? '');
    // Reset the dependent UOM selection until defaults resolve.
    setValue('item_uom_id', null);
    setValue('uom_label', '');
    if (!id) return;

    try {
      const d = await resolveItemDefaults(id);
      if (getValues('item_id') !== id) return; // superseded by a newer pick

      if (d.cost != null) setValue('unit_cost', d.cost);
      if (d.itemUomId != null) {
        setValue('item_uom_id', d.itemUomId);
        setValue('uom_label', d.uomName);
      }
      // Location: only when empty, and only if the item's default location is
      // valid for the receipt warehouse (avoid injecting a cross-warehouse id).
      const whMatches =
        d.defaultWarehouseId == null || d.defaultWarehouseId === warehouseId;
      if (!getValues('location_id') && d.defaultLocationId && whMatches) {
        setValue('location_id', d.defaultLocationId);
        setValue('location_label', d.defaultLocationName);
      }
    } catch {
      // best-effort; user can enter values manually
    }
  }

  // The SerialEntryPanel manages the serial list itself (scan-first log);
  // no qty-padding here — the panel enforces the count against receipt_qty.

  return (
    <div className="space-y-4">
      {/* Selects */}
      <div className="space-y-4">
        {/* Product — full width */}
        <Controller
          name="item_id"
          control={control}
          rules={{ required: 'Product is required' }}
          render={({ field: f }) => (
            <div>
              <AsyncSearchSelect
                label="Product"
                placeholder="Select product..."
                apiUrl={API.inventory.stockItem.root}
                value={f.value}
                selectedLabel={watch('item_label') ?? ''}
                enablePopupSearch
                onChangeAction={onPickItem}
              />
              {errors.item_id && (
                <p className="mt-1 text-xs text-red-500">
                  {errors.item_id.message}
                </p>
              )}
            </div>
          )}
        />

        {/* UOM / Warehouse / Location */}
        <div className="grid gap-4 sm:grid-cols-2">
          {/* UOM — dependent on the selected product */}
          {itemId ? (
            <Controller
              key={itemId}
              name="item_uom_id"
              control={control}
              render={({ field: f }) => (
                <div>
                  {/* Defaults to the item's base UOM; any other unit the item
                      defines can be received in. */}
                  <ItemUomSelect
                    itemId={itemId}
                    value={f.value}
                    onChangeAction={(sel) => {
                      f.onChange(sel.itemUomId);
                      setValue('uom_label', sel.name);
                      setMeta((m) =>
                        m ? { ...m, baseFactor: sel.baseFactor } : m,
                      );
                    }}
                  />
                  <QuantityInBase
                    quantity={receiptQty}
                    conversion={baseFactor}
                    uomName={watch('uom_label') ?? ''}
                    baseUomName={baseUomName}
                  />
                </div>
              )}
            />
          ) : (
            <div className="space-y-1.5">
              <FieldLabel>UOM</FieldLabel>
              <div className="w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-400">
                Select a product first
              </div>
            </div>
          )}

          {/* Location — dependent on warehouse */}
          {warehouseId ? (
            <Controller
              key={warehouseId}
              name="location_id"
              control={control}
              render={({ field: f }) => (
                <AsyncSearchSelect
                  label="Location"
                  placeholder="Select location..."
                  apiUrl={API.inventory.warehouse.locations(warehouseId)}
                  value={f.value}
                  selectedLabel={watch('location_label') ?? ''}
                  enablePopupSearch
                  onChangeAction={(selected) => {
                    f.onChange(selected?.id ? Number(selected.id) : null);
                    setValue('location_label', selected?.name ?? '');
                  }}
                />
              )}
            />
          ) : (
            <div className="space-y-1.5">
              <FieldLabel>Location</FieldLabel>
              <div className="w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-400">
                Select a warehouse first
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Numbers */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <FieldLabel required>Receipt Qty</FieldLabel>
          <EditableInput
            type="number"
            min={0}
            step="0.001"
            placeholder="0"
            {...register('receipt_qty', {
              required: 'Qty is required',
              setValueAs: (v) => (v === '' ? '' : Number(v)),
            })}
          />
          {errors.receipt_qty && (
            <p className="mt-1 text-xs text-red-500">
              {errors.receipt_qty.message}
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <FieldLabel required>Unit Cost</FieldLabel>
          <EditableInput
            type="number"
            min={0}
            step="0.0001"
            placeholder="0.00"
            {...register('unit_cost', {
              required: 'Unit cost is required',
              setValueAs: (v) => (v === '' ? '' : Number(v)),
            })}
          />
          {errors.unit_cost && (
            <p className="mt-1 text-xs text-red-500">
              {errors.unit_cost.message}
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <FieldLabel>Purchase Date</FieldLabel>
          <EditableInput type="date" {...register('purchased_date')} />
        </div>
      </div>

      {serialEnabled && (
        <div className="space-y-1.5">
          <FieldLabel>Serial Numbers</FieldLabel>
          <SerialEntryPanel
            value={(serialNumbers as string[]).filter(Boolean)}
            onChange={(serials) => setValue('serial_numbers', serials)}
            requiredCount={receiptQty * baseFactor}
            generate={
              itemId
                ? {
                    itemId,
                    warehouseId: warehouseId ?? undefined,
                    mode: serialGeneration,
                  }
                : undefined
            }
          />
        </div>
      )}
    </div>
  );
}


