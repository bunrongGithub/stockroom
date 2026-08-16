'use client';

import AsyncSearchSelect from '@/components/ui/AsyncSearchSelect';
import {
  EditableInput,
  EditableTextarea,
  FieldLabel,
} from '@/components/ui/FieldLabel';
import { ReadonlyInput } from '@/components/ui/Readonly';
import {
  FieldGrid,
  FormHeader,
  FormLayout,
  HeaderAction,
  SectionCard,
  SidebarCard,
  StepButton,
  SummaryRow,
  TabNav,
  TabPanel,
} from '@/components/ui/FormShell';
import {
  LineDialogFact,
  LineItemDialog,
} from '@/components/ui/LineItemDialog';
import { API } from '@/lib/constant';
import type { InventoryMovemtTypeReasonMeta } from '@/service/apps/inventory/repo/receipt';
import {
  ArrowLeftIcon,
  ChevronDown,
  ChevronRight,
  Loader2,
  Package,
  PencilIcon,
  PlusIcon,
  SaveIcon,
  Trash2Icon,
  Warehouse as WarehouseIcon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { REASON_META } from '../columns';
import { useItemAutoFill } from '@/hook/useItemAutoFill';
import { FormProvider, useForm as useLineForm } from 'react-hook-form';
import ReceiptItemFields, {
  DEFAULT_LINE,
  type LineItem,
} from './ReceiptItemFields';

const REASON_OPTIONS = Object.keys(
  REASON_META,
) as InventoryMovemtTypeReasonMeta[];

const TABS = [
  { id: 'info' as const, label: 'Receipt Info', num: 1 },
  { id: 'items' as const, label: 'Items', num: 2 },
];
type TabId = (typeof TABS)[number]['id'];

/**
 * The receipt line editor.
 *
 * Wraps the shared LineItemDialog around this line's own react-hook-form
 * instance, so the document form and the line form stay independent: nothing
 * the user types here reaches the receipt until they press Add/Update. That was
 * previously FormDialog's job; folding it in here is what lets the line use the
 * same dialog — and the same two-tab serial split — as every other document.
 */
function ReceiptLineDialog({
  open,
  onOpenChangeAction,
  editing,
  initialValue,
  warehouseId,
  warehouseName,
  onSaveAction,
}: {
  open: boolean;
  onOpenChangeAction: (open: boolean) => void;
  editing: boolean;
  initialValue: LineItem | null;
  warehouseId: number | null;
  warehouseName: string;
  onSaveAction: (values: LineItem) => void;
}) {
  const methods = useLineForm<LineItem>({ defaultValues: DEFAULT_LINE });
  const [tab, setTab] = useState('details');
  const [wasOpen, setWasOpen] = useState(open);
  const { resolveItemDefaults } = useItemAutoFill();
  /**
   * Whether THIS line's item is serial tracked, resolved here rather than read
   * out of ReceiptItemFields' local state. The dialog decides whether to show
   * the Serials tab, and that decision must survive the child remounting when
   * the tab strip appears — otherwise the tabs would toggle themselves off.
   * `resolveItemDefaults` is the shared cached lookup, so this costs no extra
   * request.
   */
  const [serialTracked, setSerialTracked] = useState(false);

  // Reset on each open (editing values or blanks). Adjusted during render
  // rather than in an effect — the dialog also closes programmatically on save.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      methods.reset(initialValue ?? DEFAULT_LINE);
      setTab('details');
    }
  }

  const itemId = methods.watch('item_id');
  const serials = (methods.watch('serial_numbers') ?? []).filter(Boolean);
  const qty = Number(methods.watch('receipt_qty') || 0);

  useEffect(() => {
    if (!open || !itemId) {
      setSerialTracked(false);
      return;
    }
    let active = true;
    resolveItemDefaults(Number(itemId))
      .then((d) => active && setSerialTracked(!!d?.trackSerial))
      .catch(() => active && setSerialTracked(false));
    return () => {
      active = false;
    };
  }, [open, itemId, resolveItemDefaults]);

  const submit = methods.handleSubmit((values) => {
    onSaveAction(values);
    onOpenChangeAction(false);
  });

  const details = <ReceiptItemFields warehouseId={warehouseId} section="details" />;

  return (
    <FormProvider {...methods}>
      <LineItemDialog
        open={open}
        onOpenChange={onOpenChangeAction}
        mode={editing ? 'edit' : 'create'}
        onConfirm={submit}
        activeTab={tab}
        onTabChangeAction={setTab}
        context={
          warehouseName ? (
            <LineDialogFact
              icon={<WarehouseIcon className="text-emerald-600" size={13} />}
            >
              {warehouseName}
            </LineDialogFact>
          ) : undefined
        }
        tabs={
          serialTracked
            ? [
                { id: 'details', label: 'Item Details', content: details },
                {
                  id: 'serials',
                  label: 'Serials',
                  badge: (
                    <span
                      className={
                        serials.length === qty
                          ? 'text-emerald-600'
                          : 'text-amber-600'
                      }
                    >
                      {serials.length}/{qty}
                    </span>
                  ),
                  content: (
                    <ReceiptItemFields
                      warehouseId={warehouseId}
                      section="serials"
                    />
                  ),
                },
              ]
            : undefined
        }
      >
        {details}
      </LineItemDialog>
    </FormProvider>
  );
}

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
  source_reference_no: string;
  reason: InventoryMovemtTypeReasonMeta | '';
  notes: string;
  status: Status;
  warehouse: { id: number | null; name: string };
  items: LineItem[];
};

export default function Create() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState('');
  const [activeTab, setActiveTab] = useState<TabId>('info');

  // Item modal state — null editingIndex means "adding a new item".
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const {
    control,
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      transaction_date: today,
      source_reference_no: '',
      reason: '',
      notes: '',
      status: 'DRAFT',
      warehouse: { id: null, name: '' },
      items: [],
    },
  });

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
        source_reference_no: data.source_reference_no || null,
        reason: data.reason || null,
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

      const res = await fetch(API.inventory.receipt.root, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok) {
        setSubmitError(json.error ?? 'Something went wrong. Please try again.');
        return;
      }

      router.push(`/inventory/receipts/${json.data.id}/view`);
      router.refresh();
    } catch {
      setSubmitError('An unexpected error occurred. Please try again.');
    }
  };

  return (
    <div className="space-y-4 font-mono text-xs">
      {/* The form wraps the whole layout so Save stays a native submit button
          while sitting in the page header's action group. */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <FormHeader
          onBackAction={() => router.back()}
          backLabel="Back"
          icon={<Package />}
          title="Receipt"
          subtitle="Receive stock into a warehouse through the movement ledger."
          actions={
            <>
              <HeaderAction label="Discard" onClick={() => router.back()} />
              <HeaderAction
                tone="primary"
                type="submit"
                label={isSubmitting ? 'Saving' : 'Save'}
                icon={
                  isSubmitting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <SaveIcon size={16} />
                  )
                }
                disabled={isSubmitting}
              />
            </>
          }
        />

        {submitError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
            {submitError}
          </div>
        )}

        <FormLayout
          sidebar={
            <SidebarCard icon={<Package size={13} />} title="Receipt Summary">
              <div className="space-y-2">
                <SummaryRow label="Reference">Auto-generated</SummaryRow>
                <SummaryRow label="Warehouse" title={warehouse.name || undefined}>
                  {warehouse.name || '—'}
                </SummaryRow>
                <SummaryRow label="Movement">receipt</SummaryRow>
                <SummaryRow label="Lines">{fields.length}</SummaryRow>
                <SummaryRow label="Grand Total" strong>
                  ${grandTotal.toFixed(2)}
                </SummaryRow>
              </div>
            </SidebarCard>
          }
        >
          <TabNav tabs={TABS} active={activeTab} onChangeAction={setActiveTab} />

          {/* Tab 1: Receipt Info */}
          {activeTab === 'info' && (
            <TabPanel>
              <SectionCard
                icon={<WarehouseIcon size={13} />}
                title="Receipt Information"
              >
                <FieldGrid>
                  <div>
                    <FieldLabel>Reference No</FieldLabel>
                    <ReadonlyInput placeholder="Auto-generated" />
                  </div>
                  <div>
                    <FieldLabel>Supplier Ref No</FieldLabel>
                    <EditableInput
                      type="text"
                      placeholder="Supplier invoice / PO (optional)"
                      {...register('source_reference_no')}
                    />
                  </div>
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
                  <div>
                    <FieldLabel>Movement Type</FieldLabel>
                    <ReadonlyInput value="receipt" />
                  </div>
                  <div>
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
                  <div>
                    <FieldLabel>Reason</FieldLabel>
                    <Controller
                      name="reason"
                      control={control}
                      render={({ field }) => (
                        <ReasonSelect
                          value={field.value}
                          onChange={field.onChange}
                        />
                      )}
                    />
                  </div>
                  <div className="lg:col-span-2">
                    <FieldLabel>Additional Note</FieldLabel>
                    <EditableTextarea
                      placeholder="Optional notes..."
                      rows={2}
                      {...register('notes')}
                    />
                  </div>
                </FieldGrid>
              </SectionCard>

              <div className="flex justify-end">
                <StepButton onClick={() => setActiveTab('items')}>
                  Items <ChevronRight size={16} />
                </StepButton>
              </div>
            </TabPanel>
          )}

          {/* Tab 2: Items */}
          {activeTab === 'items' && (
            <TabPanel>
              <SectionCard
                icon={<Package size={13} />}
                title={`Receipt Items (${fields.length})`}
                action={
                  <button
                    type="button"
                    onClick={openAddItem}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#1a9e52] px-3 py-2 text-white transition-colors hover:bg-[#158042]"
                  >
                    <PlusIcon size={13} /> Add Item
                  </button>
                }
              >
                {fields.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-slate-400">
                    No items added yet. Click “Add Item” to get started.
                  </p>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs font-mono">
                        <thead>
                          <tr className="border-b text-muted-foreground">
                            <th className="py-2 pr-3 text-left font-medium">
                              Product
                            </th>
                            <th className="py-2 pr-3 text-left font-medium">
                              UOM
                            </th>
                            <th className="py-2 pr-3 text-left font-medium">
                              Location
                            </th>
                            <th className="py-2 pr-3 text-right font-medium">
                              Qty
                            </th>
                            <th className="py-2 pr-3 text-right font-medium">
                              Unit Cost
                            </th>
                            <th className="py-2 pr-3 text-right font-medium">
                              Total Cost
                            </th>
                            <th className="py-2 text-right font-medium">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {fields.map((field, index) => {
                            const row = watchedItems[index];
                            const lineTotal =
                              (Number(row?.receipt_qty) || 0) *
                              (Number(row?.unit_cost) || 0);
                            return (
                              <tr
                                key={field.id}
                                onClick={() => openEditItem(index)}
                                title="Edit this line"
                                className="cursor-pointer border-b last:border-b-0 hover:bg-muted/30"
                              >
                                <td className="py-2 pr-3 font-medium">
                                  {row?.item_label || '—'}
                                </td>
                                <td className="py-2 pr-3">
                                  {row?.uom_label || '—'}
                                </td>
                                <td className="py-2 pr-3">
                                  {row?.location_label || '—'}
                                </td>
                                <td className="py-2 pr-3 text-right">
                                  {row?.receipt_qty || 0}
                                </td>
                                <td className="py-2 pr-3 text-right">
                                  ${Number(row?.unit_cost || 0).toFixed(2)}
                                </td>
                                <td className="py-2 pr-3 text-right font-semibold">
                                  ${lineTotal.toFixed(2)}
                                </td>
                                <td className="py-2 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      type="button"
                                      title="Edit line"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openEditItem(index);
                                      }}
                                      className="rounded-lg border border-violet-200 p-1.5 text-violet-600 hover:bg-violet-50"
                                    >
                                      <PencilIcon size={12} />
                                    </button>
                                    <button
                                      type="button"
                                      title="Remove line"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        remove(index);
                                      }}
                                      className="rounded-lg border border-rose-200 p-1.5 text-rose-600 hover:bg-rose-50"
                                    >
                                      <Trash2Icon size={12} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="mt-4 flex justify-end">
                      <div className="w-56">
                        <div className="flex justify-between border-t pt-1.5 text-sm font-semibold">
                          <span>Grand Total</span>
                          <span>${grandTotal.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </SectionCard>

              <div className="flex justify-start">
                <StepButton onClick={() => setActiveTab('info')}>
                  <ArrowLeftIcon size={16} /> Receipt Info
                </StepButton>
              </div>
            </TabPanel>
          )}
        </FormLayout>
      </form>

      {/* Add / Edit item popup */}
      <ReceiptLineDialog
        open={itemModalOpen}
        onOpenChangeAction={setItemModalOpen}
        editing={editingIndex !== null}
        initialValue={
          editingIndex !== null
            ? (watchedItems[editingIndex] ?? DEFAULT_LINE)
            : null
        }
        warehouseId={warehouse.id}
        warehouseName={warehouse.name}
        onSaveAction={handleSaveItem}
      />
    </div>
  );
}
