'use client';

import AsyncSearchSelect from '@/components/ui/AsyncSearchSelect';
import SerialEntryPanel from '@/components/ui/serial/SerialEntryPanel';
import { EditableInput, FieldLabel } from '@/components/ui/FieldLabel';
import { API } from '@/lib/constant';
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
    formState: { errors },
  } = useFormContext<LineItem>();

  // Prefer the receipt-level warehouse passed from the parent; fall back to the
  // value already stored on the line item (e.g. when editing an existing row).
  const warehouseId = warehouseIdProp ?? watch('warehouse_id');

  // UOM options are scoped to the selected product (item_uom rows).
  const itemId = watch('item_id');
  const serialNumbers = watch('serial_numbers') ?? [];
  const receiptQty = Number(watch('receipt_qty') || 0);
  const [serialEnabled, setSerialEnabled] = useState(false);

  useEffect(() => {
    if (!itemId) {
      setSerialEnabled(false);
      setValue('serial_numbers', []);
      return;
    }

    let active = true;
    fetch(`${API.inventory.stockItem.detail(itemId)}`)
      .then((res) => res.json())
      .then((json) => {
        if (!active) return;
        const enabled = Boolean(json.data?.track_serial);
        setSerialEnabled(enabled);
        if (!enabled) {
          setValue('serial_numbers', []);
        }
      })
      .catch(() => {
        if (active) setSerialEnabled(false);
      });

    return () => {
      active = false;
    };
  }, [itemId, setValue]);

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
                onChangeAction={(selected) => {
                  f.onChange(selected?.id ? Number(selected.id) : null);
                  setValue('item_label', selected?.name ?? '');
                }}
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
                <AsyncSearchSelect
                  label="UOM"
                  placeholder="Select UOM..."
                  apiUrl={`${API.inventory.itemUom.root}?item_id=${itemId}`}
                  value={f.value}
                  selectedLabel={watch('uom_label') ?? ''}
                  enablePopupSearch
                  onChangeAction={(selected) => {
                    f.onChange(selected?.id ? Number(selected.id) : null);
                    setValue('uom_label', selected?.name ?? '');
                  }}
                />
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
          <FieldLabel>Lot #</FieldLabel>
          <EditableInput
            type="text"
            placeholder="optional"
            {...register('lot_number')}
          />
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
            requiredCount={receiptQty}
          />
        </div>
      )}
    </div>
  );
}
