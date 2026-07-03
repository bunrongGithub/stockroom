'use client';

import AsyncSearchSelect from '@/components/ui/AsyncSearchSelect';
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

  useEffect(() => {
    if (!serialEnabled) return;

    const qty = Number(watch('receipt_qty') || 0);
    if (qty <= 0) {
      if (serialNumbers.length) {
        setValue('serial_numbers', []);
      }
      return;
    }

    const nextSerials = Array.from(
      { length: qty },
      (_, index) => serialNumbers[index] ?? '',
    );
    const hasChanged =
      nextSerials.length !== serialNumbers.length ||
      nextSerials.some((value, index) => value !== serialNumbers[index]);

    if (hasChanged) {
      setValue('serial_numbers', nextSerials);
    }
  }, [receiptQty, serialEnabled, serialNumbers, setValue, watch]);

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
        <div className="space-y-2 rounded-xl border border-emerald-100 bg-emerald-50/50 p-3">
          <div className="flex items-center justify-between">
            <FieldLabel>Serial Numbers</FieldLabel>
            <span className="text-[11px] text-slate-500">
              {receiptQty || 0} row{receiptQty === 1 ? '' : 's'}
            </span>
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-slate-50 text-left text-slate-500">
                  <th className="px-2 py-2 font-medium">#</th>
                  <th className="px-2 py-2 font-medium">Serial</th>
                </tr>
              </thead>
              <tbody>
                {(serialNumbers as string[]).map((serial, index) => (
                  <tr
                    key={`${index}-${serial}`}
                    className="border-b last:border-b-0"
                  >
                    <td className="w-12 px-2 py-2 text-slate-500">
                      {index + 1}
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="text"
                        value={serial}
                        placeholder={`Serial ${index + 1}`}
                        onChange={(e) => {
                          const updated = [...(serialNumbers as string[])];
                          updated[index] = e.target.value.trim();
                          setValue('serial_numbers', updated);
                        }}
                        className="w-full rounded-md border border-slate-200 px-2 py-1.5 font-mono text-xs outline-none focus:border-emerald-500"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-[11px] text-slate-500">
            Enter exactly {receiptQty} serial number
            {receiptQty === 1 ? '' : 's'} for this receipt line.
          </p>
        </div>
      )}
    </div>
  );
}
