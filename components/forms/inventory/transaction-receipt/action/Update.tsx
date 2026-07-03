'use client';

import AsyncSearchSelect from '@/components/ui/AsyncSearchSelect';
import {
  EditableInput,
  EditableTextarea,
  FieldLabel,
} from '@/components/ui/FieldLabel';
import { ReadonlyInput } from '@/components/ui/Readonly';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { API } from '@/lib/constant';
import type {
  InventoryMovemtTypeReasonMeta,
  ReceiptTxnType,
} from '@/service/apps/inventory/repo/receipt';
import {
  ArrowLeftIcon,
  ChevronDown,
  Loader2,
  Package,
  PencilIcon,
  PlusIcon,
  SaveIcon,
  Trash2Icon,
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { REASON_META } from '../columns';
import FormDialog from './ItemFormModal';
import ReceiptItemFields, {
  DEFAULT_LINE,
  type LineItem,
} from './ReceiptItemFields';

const REASON_OPTIONS = Object.keys(
  REASON_META,
) as InventoryMovemtTypeReasonMeta[];

/** Styled reason picker — each option renders as its colored badge (see columns.tsx). */
function ReasonSelect({
  value,
  onChange,
}: {
  value: InventoryMovemtTypeReasonMeta | '';
  onChange: (reason: InventoryMovemtTypeReasonMeta) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const selected = value ? REASON_META[value] : null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-input bg-background px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {selected ? (
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${selected.badge}`}
          >
            {selected.icon}
            {selected.label}
          </span>
        ) : (
          <span className="text-muted-foreground">Select reason...</span>
        )}
        <ChevronDown size={14} className="shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-input bg-popover p-1 shadow-md">
          {REASON_OPTIONS.map((reason) => {
            const config = REASON_META[reason];
            return (
              <button
                key={reason}
                type="button"
                onClick={() => {
                  onChange(reason);
                  setOpen(false);
                }}
                className={`flex w-full items-center rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted ${
                  value === reason ? 'bg-muted' : ''
                }`}
              >
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${config.badge}`}
                >
                  {config.icon}
                  {config.label}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

type Status = 'DRAFT' | 'OPEN' | 'VOID';
type FormValues = {
  transaction_date: string;
  reason: InventoryMovemtTypeReasonMeta | '';
  notes: string;
  status: Status;
  warehouse: { id: number | null; name: string };
  items: LineItem[];
};

/** Maps a persisted receipt into the editable form shape. */
function toFormValues(receipt: ReceiptTxnType): FormValues {
  const items = receipt.items ?? [];
  const warehouse = items[0]?.warehouse;
  return {
    transaction_date: (receipt.transaction_date ?? '').slice(0, 10),
    reason: receipt.reason ?? '',
    notes: receipt.notes ?? '',
    status: 'DRAFT',
    warehouse: { id: warehouse?.id ?? null, name: warehouse?.name ?? '' },
    items: items.map((item) => ({
      item_id: item.item_id,
      item_label: item.item?.name ?? '',
      item_uom_id: item.item_uom_id ?? null,
      uom_label: item.item_uom?.name ?? '',
      warehouse_id: item.warehouse_id,
      warehouse_label: item.warehouse?.name ?? '',
      location_id: item.location_id,
      location_label: item.location?.name ?? '',
      receipt_qty: item.receipt_qty,
      unit_cost: item.unit_cost ?? '',
      lot_number: item.lot_number ?? '',
      purchased_date: (item.purchased_date ?? '').slice(0, 10),
      serial_numbers: Array.isArray(item.serial_numbers)
        ? item.serial_numbers
        : [],
    })),
  };
}

export default function Update({
  receiptData,
}: {
  receiptData?: ReceiptTxnType | null;
}) {
  const router = useRouter();
  const params = useParams();
  const id = Number(
    Array.isArray(params.slug) ? params.slug.at(-2) : params.slug,
  );

  const [receipt, setReceipt] = useState<ReceiptTxnType | null>(
    receiptData ?? null,
  );
  const [loadError, setLoadError] = useState('');
  const [submitError, setSubmitError] = useState('');

  // Item modal state — null editingIndex means "adding a new item".
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const {
    control,
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: receiptData
      ? toFormValues(receiptData)
      : {
          transaction_date: new Date().toISOString().slice(0, 10),
          reason: '',
          notes: '',
          status: 'DRAFT',
          warehouse: { id: null, name: '' },
          items: [],
        },
  });

  // Fallback: fetch the receipt when the server didn't provide it as initialData.
  useEffect(() => {
    if (receiptData || !id) return;
    let active = true;
    (async () => {
      try {
        const res = await fetch(API.inventory.receipt.view(id));
        const json = await res.json();
        if (!active) return;
        if (!res.ok) {
          setLoadError(json.error ?? 'Failed to load receipt.');
          return;
        }
        setReceipt(json.data as ReceiptTxnType);
        reset(toFormValues(json.data as ReceiptTxnType));
      } catch {
        if (active) setLoadError('Failed to load receipt.');
      }
    })();
    return () => {
      active = false;
    };
  }, [id, receiptData, reset]);

  const warehouse = watch('warehouse');

  const { fields, append, update, remove } = useFieldArray({
    control,
    name: 'items',
  });
  const watchedItems = watch('items');

  const grandTotal = watchedItems.reduce(
    (sum, item) =>
      sum + (Number(item.receipt_qty) || 0) * (Number(item.unit_cost) || 0),
    0,
  );

  const openAddItem = () => {
    setEditingIndex(null);
    setItemModalOpen(true);
  };

  const openEditItem = (index: number) => {
    setEditingIndex(index);
    setItemModalOpen(true);
  };

  const handleSaveItem = (item: LineItem) => {
    // Stamp the receipt-level warehouse onto every line item.
    const withWarehouse: LineItem = {
      ...item,
      warehouse_id: warehouse.id,
      warehouse_label: warehouse.name,
    };
    if (editingIndex === null) append(withWarehouse);
    else update(editingIndex, withWarehouse);
  };

  const onSubmit = async (data: FormValues) => {
    setSubmitError('');
    if (data.items.length === 0) {
      setSubmitError('Add at least one item before saving.');
      return;
    }
    try {
      const payload = {
        transaction_date: data.transaction_date,
        reference_no: receipt?.reference_no ?? null,
        reason: data.reason || '',
        notes: data.notes || null,
        movement_type: 'receipt',
        status: 'DRAFT',
        items: data.items.map((item) => ({
          item_id: item.item_id,
          item_uom_id: item.item_uom_id,
          warehouse_id: item.warehouse_id,
          location_id: item.location_id,
          receipt_qty: Number(item.receipt_qty),
          unit_cost: Number(item.unit_cost),
          lot_number: item.lot_number || null,
          purchased_date: item.purchased_date || null,
          serial_numbers: item.serial_numbers ?? [],
        })),
      };

      const res = await fetch(API.inventory.receipt.update(id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok) {
        setSubmitError(json.error ?? 'Something went wrong. Please try again.');
        return;
      }

      router.push(`/inventory/receipts/${id}/view`);
      router.refresh();
    } catch {
      setSubmitError('An unexpected error occurred. Please try again.');
    }
  };

  if (loadError) {
    return <p className="py-10 text-center text-red-500">{loadError}</p>;
  }

  if (!receipt) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={20} className="animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-xl font-bold text-slate-800">
          <Package size={18} className="text-emerald-600" />
          Edit {receipt.reference_no || 'Receipt Transaction'}
        </h2>
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs hover:bg-muted font-mono"
        >
          <ArrowLeftIcon size={13} /> Back
        </button>
      </div>

      {submitError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          {submitError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* ── Receipt Information ── */}
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">
              Receipt Information
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <FieldLabel>Reference No</FieldLabel>
              <ReadonlyInput value={receipt.reference_no ?? ''} />
            </div>
            {/* Warehouse */}
            <Controller
              name="warehouse"
              control={control}
              render={({ field: f }) => (
                <AsyncSearchSelect
                  label="Warehouse"
                  placeholder="Select warehouse..."
                  apiUrl={API.inventory.warehouse.root}
                  value={f.value?.id ?? null}
                  selectedLabel={f.value?.name ?? ''}
                  enablePopupSearch
                  onChangeAction={(selected) => {
                    f.onChange({
                      id: selected?.id ? Number(selected.id) : null,
                      name: selected?.name ?? '',
                    });
                  }}
                />
              )}
            />
            <div className="space-y-1.5">
              <FieldLabel>Movement Type</FieldLabel>
              <ReadonlyInput value="receipt" />
            </div>

            <div className="space-y-1.5">
              <FieldLabel required>Transaction Date</FieldLabel>
              <EditableInput
                type="date"
                {...register('transaction_date', {
                  required: 'Transaction date is required',
                })}
              />
              {errors.transaction_date && (
                <p className="mt-1 text-xs text-red-500">
                  {errors.transaction_date.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Reason</FieldLabel>
              <Controller
                name="reason"
                control={control}
                render={({ field }) => (
                  <ReasonSelect value={field.value} onChange={field.onChange} />
                )}
              />
            </div>

            <div className="col-span-2 space-y-1.5">
              <FieldLabel>Additional Note</FieldLabel>
              <EditableTextarea
                placeholder="Optional notes..."
                rows={2}
                {...register('notes')}
              />
            </div>
          </CardContent>

          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm font-semibold">
              Receipt Items
            </CardTitle>
            <button
              type="button"
              onClick={openAddItem}
              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs text-white hover:bg-emerald-500 font-mono"
            >
              <PlusIcon size={12} /> Add Item
            </button>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="py-2 pr-2 text-left font-medium">Product</th>
                    <th className="py-2 pr-2 text-left font-medium">UOM</th>
                    <th className="py-2 pr-2 text-left font-medium">
                      Location
                    </th>
                    <th className="py-2 pr-2 text-right font-medium">Qty</th>
                    <th className="py-2 pr-2 text-right font-medium">
                      Unit Cost
                    </th>
                    <th className="py-2 pr-2 text-right font-medium">
                      Total Cost
                    </th>
                    <th className="py-2 pr-2 text-right font-medium">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {fields.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="py-8 text-center text-muted-foreground"
                      >
                        No items added yet. Click “Add Item” to get started.
                      </td>
                    </tr>
                  ) : (
                    fields.map((field, index) => {
                      const row = watchedItems[index];
                      const lineTotal =
                        (Number(row?.receipt_qty) || 0) *
                        (Number(row?.unit_cost) || 0);

                      return (
                        <tr
                          key={field.id}
                          className="border-b hover:bg-muted/20"
                        >
                          <td className="py-2 pr-2">
                            {row?.item_label || '—'}
                          </td>
                          <td className="py-2 pr-2">{row?.uom_label || '—'}</td>
                          <td className="py-2 pr-2">
                            {row?.location_label || '—'}
                          </td>
                          <td className="py-2 pr-2 text-right">
                            {row?.receipt_qty || 0}
                          </td>
                          <td className="py-2 pr-2 text-right">
                            ${Number(row?.unit_cost || 0).toFixed(2)}
                          </td>
                          <td className="py-2 pr-2 text-right font-semibold">
                            ${lineTotal.toFixed(2)}
                          </td>
                          <td className="py-2 pr-2">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => openEditItem(index)}
                                className="text-slate-400 hover:text-emerald-600"
                                title="Edit"
                              >
                                <PencilIcon size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => remove(index)}
                                className="text-rose-400 hover:text-rose-600"
                                title="Remove"
                              >
                                <Trash2Icon size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Grand total */}
            <div className="mt-4 flex justify-end">
              <div className="w-56 space-y-1.5 text-xs font-mono">
                <div className="flex justify-between border-t pt-1.5 font-semibold text-sm">
                  <span>Grand Total</span>
                  <span>${grandTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        {/* Footer */}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-xl border px-4 py-2 text-xs hover:bg-muted font-mono"
          >
            Discard
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs text-white hover:bg-emerald-500 font-mono disabled:opacity-60"
          >
            {isSubmitting ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <SaveIcon size={13} />
            )}
            {isSubmitting ? 'Saving...' : 'Save Receipt'}
          </button>
        </div>
      </form>

      {/* Add / Edit item popup */}
      <FormDialog<LineItem>
        open={itemModalOpen}
        onOpenChange={setItemModalOpen}
        title={editingIndex !== null ? 'Edit Item' : 'Add Item'}
        description="Select the product and enter the receipt details."
        submitLabel={editingIndex !== null ? 'Save Item' : 'Add Item'}
        defaultValues={DEFAULT_LINE}
        initialValue={
          editingIndex !== null
            ? (watchedItems[editingIndex] ?? DEFAULT_LINE)
            : null
        }
        onSave={handleSaveItem}
        className="sm:max-w-2xl"
      >
        <ReceiptItemFields warehouseId={warehouse.id} />
      </FormDialog>
    </div>
  );
}
