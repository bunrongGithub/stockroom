'use client';

import AsyncSearchSelect from '@/components/ui/AsyncSearchSelect';
import BusinessPartnerLookup from '@/components/master-data/BusinessPartnerLookup';
import ItemUomSelect, {
  baseOptionOf,
  fetchItemUoms,
} from '@/components/ui/ItemUomSelect';
import { QuantityInBase } from '@/components/ui/UomConversionPreview';
import { roundQty } from '@/service/core/uom-conversion';
import {
  EditableInput,
  EditableTextarea,
  FieldLabel,
} from '@/components/ui/FieldLabel';
import { ReadonlyInput } from '@/components/ui/Readonly';
import {
  LineDialogFact,
  LineItemDialog,
} from '@/components/ui/LineItemDialog';
import {
  FieldGrid,
  FormHeader,
  FormLayout,
  HeaderAction,
  SectionCard,
  SidebarCard,
  StepButton,
  TabNav,
  TabPanel,
} from '@/components/ui/FormShell';
import { API } from '@/lib/constant';
import { saleOrderApi } from '@/lib/api/sale';
import { useItemAutoFill } from '@/hook/useItemAutoFill';
import { behaviorOf } from '@/service/core/item-behavior';
import type { SalesOrder } from '@/types/sales/order-management';
import type { BusinessPartnerOption } from '@/types/master-data/business-partner';
import {
  AlertCircle,
  ArrowLeftIcon,
  ChevronRight,
  ClipboardList,
  Loader2Icon,
  Package,
  PencilIcon,
  PlusIcon,
  ReceiptText,
  SaveIcon,
  Trash2Icon,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const TABS = [
  { id: 'details' as const, label: 'Details', num: 1 },
  { id: 'items' as const, label: 'Items', num: 2 },
];
type TabId = (typeof TABS)[number]['id'];

type LineDraft = {
  key: string;
  id?: number; // DB id of an existing line (edit mode); absent for new lines
  item_id: number | null;
  /** stock | non_stock | service — null until the item resolves. */
  item_class: string | null;
  product_name: string;
  item_uom_id: number | null;
  uom: string;
  /** base_qty = ordered_qty × base_factor. 1 while the line is in base UOM. */
  base_factor?: number;
  /** The item's base unit name, for the "5 Box = 60 Piece" hint. */
  base_uom_name?: string;
  ordered_qty: number;
  unit_price: number;
  discount: number;
  tax: number;
};

let keySeq = 0;
function emptyLine(): LineDraft {
  return {
    key: `l${keySeq++}`,
    item_id: null,
    item_class: null,
    product_name: '',
    item_uom_id: null,
    uom: '',
    base_factor: 1,
    base_uom_name: '',
    ordered_qty: 1,
    unit_price: 0,
    discount: 0,
    tax: 0,
  };
}

function fmt(n: number) {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function OrderForm({
  mode,
  initial,
}: {
  mode: 'create' | 'edit';
  initial?: SalesOrder;
}) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);

  const [activeTab, setActiveTab] = useState<TabId>('details');
  const [referenceNo, setReferenceNo] = useState(initial?.reference_no ?? '');
  const [customerName, setCustomerName] = useState(
    initial?.customer_name ?? '',
  );
  const [customerPhone, setCustomerPhone] = useState(
    initial?.customer_phone ?? '',
  );
  // Editing pre-Master-Data history: the order has a name but no link yet, so
  // the lookup starts empty and prompts for one.
  const [partner, setPartner] = useState<BusinessPartnerOption | null>(
    initial?.customer_id
      ? {
          id: initial.customer_id,
          code: initial.customer_code ?? '',
          name: initial.customer_name,
          phone: initial.customer_phone ?? null,
          roles: ['customer'],
        }
      : null,
  );
  const [orderDate, setOrderDate] = useState(
    initial?.order_date?.slice(0, 10) ?? today,
  );
  const [expectedDate, setExpectedDate] = useState(
    initial?.expected_delivery_date?.slice(0, 10) ?? '',
  );
  const [warehouseId, setWarehouseId] = useState<number | null>(
    initial?.warehouse_id ?? null,
  );
  const [warehouseName, setWarehouseName] = useState(
    initial?.warehouse_name ?? '',
  );
  const [currency, setCurrency] = useState(initial?.currency ?? 'USD');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [items, setItems] = useState<LineDraft[]>(
    initial && initial.items.length
      ? initial.items.map((i) => ({
          key: `l${keySeq++}`,
          id: i.id,
          item_id: i.item_id,
          item_class: i.item_class ?? 'stock',
          product_name: i.product_name,
          item_uom_id: i.item_uom_id,
          uom: i.uom,
          ordered_qty: i.ordered_qty,
          unit_price: i.unit_price,
          discount: i.discount,
          tax: i.tax,
        }))
      : [],
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Line editor modal: null = closed; -1 = new line; ≥0 = editing that index.
  // Mirrors Stock Adjustment, so a line is only ever committed from the dialog
  // and the tab itself stays a clean summary of what the order contains.
  const [editorIndex, setEditorIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState<LineDraft>(emptyLine);
  const [lineError, setLineError] = useState<string | null>(null);

  const { resolveItemDefaults } = useItemAutoFill();

  function openEditor(index: number) {
    setLineError(null);
    setDraft(index === -1 ? emptyLine() : { ...items[index] });
    setEditorIndex(index);
  }

  function patchDraft(patch: Partial<LineDraft>) {
    setDraft((d) => ({ ...d, ...patch }));
  }

  /** Validate the draft, then append or replace. */
  function commitLine() {
    setLineError(null);
    if (!draft.item_id) return setLineError('Select a product.');
    if (!(draft.ordered_qty > 0))
      return setLineError('Quantity must be greater than 0.');
    if (draft.unit_price < 0) return setLineError('Unit price cannot be negative.');
    if (draft.discount < 0 || draft.discount > 100)
      return setLineError('Discount must be between 0 and 100.');
    if (draft.tax < 0 || draft.tax > 100)
      return setLineError('Tax must be between 0 and 100.');

    setItems((prev) =>
      editorIndex === -1
        ? [...prev, draft]
        : prev.map((l, i) => (i === editorIndex ? draft : l)),
    );
    setEditorIndex(null);
  }

  // Auto-populate the DRAFT from the item master on selection. Fills price +
  // UOM and defaults the (header) warehouse when empty; preserves qty/discount/
  // tax already entered. A stale response for a superseded selection is ignored.
  async function onPickItem(
    sel: { id: string | number | null; name: string } | null,
  ) {
    const id = sel?.id ? Number(sel.id) : null;
    // Immediate: set the item + reset the dependent UOM select.
    patchDraft({
      item_id: id,
      item_class: null,
      product_name: sel?.name ?? '',
      item_uom_id: null,
      uom: '',
    });
    if (!id) return;

    try {
      // The item's units come along with its defaults so the line knows both
      // what it is denominated in and what the base unit is called — the
      // "5 Box = 60 Piece" hint needs both names.
      const [d, uoms] = await Promise.all([
        resolveItemDefaults(id),
        fetchItemUoms(id).catch(() => []),
      ]);
      const base = baseOptionOf(uoms);
      const picked = uoms.find((u) => u.id === d.itemUomId) ?? base;

      setDraft((l) =>
        l.item_id === id
          ? {
              ...l,
              item_class: d.itemClass,
              unit_price: d.price ?? l.unit_price,
              item_uom_id: d.itemUomId ?? picked?.id ?? l.item_uom_id,
              uom: d.uomName || picked?.name || l.uom,
              base_factor: picked?.baseFactor ?? 1,
              base_uom_name: base?.name ?? '',
            }
          : l,
      );
      // Default the header warehouse only when the user hasn't chosen one.
      if (d.defaultWarehouseId) {
        setWarehouseId((w) => w ?? d.defaultWarehouseId);
        setWarehouseName((n) => n || d.defaultWarehouseName);
      }
    } catch {
      // Auto-fill is best-effort; the user can still enter values manually.
    }
  }

  const subtotal = items.reduce((s, i) => s + i.ordered_qty * i.unit_price, 0);
  const discountTotal = items.reduce(
    (s, i) => s + i.ordered_qty * i.unit_price * (i.discount / 100),
    0,
  );
  const taxTotal = items.reduce((s, i) => {
    const b = i.ordered_qty * i.unit_price * (1 - i.discount / 100);
    return s + b * (i.tax / 100);
  }, 0);
  const grandTotal = subtotal - discountTotal + taxTotal;

  // A warehouse only matters when something will ship. Unresolved lines are
  // treated as stock (the safe default) until their class arrives.
  const needsWarehouse = items.some(
    (l) =>
      l.item_id != null && behaviorOf(l.item_class ?? 'stock').requiresWarehouse,
  );

  async function handleSubmit() {
    setError('');
    if (!partner) {
      setActiveTab('details');
      return setError(
        'Select a business partner — use "Create partner" in the search box if they are new',
      );
    }
    if (needsWarehouse && !warehouseId) {
      setActiveTab('details');
      return setError('Warehouse is required when the order has stock items');
    }
    if (items.length === 0) {
      setActiveTab('items');
      return setError('Add at least one item');
    }
    for (const [i, l] of items.entries()) {
      if (!l.item_id) {
        setActiveTab('items');
        return setError(`Select a product on item ${i + 1}`);
      }
      if (l.ordered_qty <= 0) {
        setActiveTab('items');
        return setError(`Quantity must be greater than 0 on item ${i + 1}`);
      }
      if (l.unit_price < 0) {
        setActiveTab('items');
        return setError(`Invalid price on item ${i + 1}`);
      }
    }

    setSaving(true);
    try {
      const payload = {
        reference_no: referenceNo.trim() || undefined,
        customer_id: partner.id,
        customer_name: (customerName || partner.name).trim(),
        customer_phone: customerPhone || partner.phone || undefined,
        order_date: orderDate,
        expected_delivery_date: expectedDate || undefined,
        warehouse_id: warehouseId ?? undefined,
        currency,
        notes: notes || undefined,
        items: items.map((l) => ({
          ...(l.id ? { id: l.id } : {}),
          item_id: l.item_id as number,
          item_uom_id: l.item_uom_id ?? undefined,
          description: l.product_name,
          uom: l.uom,
          ordered_qty: Number(l.ordered_qty),
          unit_price: Number(l.unit_price),
          discount: Number(l.discount),
          tax: Number(l.tax),
        })),
      };
      const saved =
        mode === 'create'
          ? await saleOrderApi.create(payload)
          : await saleOrderApi.update(initial!.id, payload);
      router.push(`/sale/order/${saved.id}/view`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save order');
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 font-mono text-xs">
      <FormHeader
        backHref="/sale/order"
        backLabel="Back"
        icon={<Package />}
        title={
          mode === 'create' ? 'Order' : `Edit ${initial?.order_no ?? 'Order'}`
        }
        actions={
          <>
            <HeaderAction label="Discard" href="/sale/order" />
            <HeaderAction
              tone="primary"
              label={saving ? 'Saving' : 'Save'}
              icon={
                saving ? (
                  <Loader2Icon className="animate-spin" size={16} />
                ) : (
                  <SaveIcon size={16} />
                )
              }
              disabled={saving}
              onClick={handleSubmit}
            />
          </>
        }
      />

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-500" />
          <p className="text-red-700">{error}</p>
          <button
            type="button"
            onClick={() => setError('')}
            className="ml-auto shrink-0 text-red-400 hover:text-red-600"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <FormLayout
        sidebar={
          <>
            <SidebarCard icon={<ReceiptText size={13} />} title="Order Summary">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Customer</span>
                  <span className="font-semibold text-slate-700">
                    {customerName || '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Items</span>
                  <span className="font-semibold text-slate-700">
                    {items.length}
                  </span>
                </div>
                <div className="mt-2 space-y-1.5 rounded-xl bg-slate-50 p-3">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Subtotal</span>
                    <span>{fmt(subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Discount</span>
                    <span className="text-rose-500">
                      - {fmt(discountTotal)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Tax</span>
                    <span>{fmt(taxTotal)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-1.5 text-sm font-semibold">
                    <span>Grand Total</span>
                    <span>
                      {currency} {fmt(grandTotal)}
                    </span>
                  </div>
                </div>
              </div>
            </SidebarCard>
            {/* Save / Discard live in the page header, not under the summary. */}
          </>
        }
      >
        <TabNav tabs={TABS} active={activeTab} onChangeAction={setActiveTab} />

        {/* Tab 1: Details */}
        {activeTab === 'details' && (
          <TabPanel>
            <SectionCard
              icon={<ClipboardList size={13} />}
              title="Order Information"
            >
              <FieldGrid>
                <div>
                  <FieldLabel>Reference No</FieldLabel>
                  <EditableInput
                    value={referenceNo}
                    onChange={(e) => setReferenceNo(e.target.value)}
                    placeholder="Customer PO / manual reference (optional)"
                  />
                </div>
                <BusinessPartnerLookup
                  label="Customer"
                  required
                  role="customer"
                  value={partner}
                  onChange={(p) => {
                    setPartner(p);
                    // The document keeps its own snapshot of the name/phone so
                    // a later rename never rewrites an issued order.
                    if (p) {
                      setCustomerName(p.name);
                      setCustomerPhone(p.phone ?? '');
                    }
                  }}
                />
                {needsWarehouse ? (
                  <AsyncSearchSelect
                    label="Warehouse"
                    required
                    placeholder="Select warehouse..."
                    apiUrl={API.inventory.warehouse.root}
                    value={warehouseId}
                    selectedLabel={warehouseName}
                    enablePopupSearch
                    onChangeAction={(sel) => {
                      setWarehouseId(sel?.id ? Number(sel.id) : null);
                      setWarehouseName(sel?.name ?? '');
                    }}
                  />
                ) : (
                  <div>
                    <FieldLabel>Warehouse</FieldLabel>
                    <ReadonlyInput placeholder="Not needed — no stock items on this order" />
                  </div>
                )}
                <div>
                  <FieldLabel>Currency</FieldLabel>
                  <EditableInput
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                  />
                </div>
                <div>
                  <FieldLabel required>Order Date</FieldLabel>
                  <EditableInput
                    type="date"
                    value={orderDate}
                    onChange={(e) => setOrderDate(e.target.value)}
                  />
                </div>
                <div>
                  <FieldLabel>Expected Delivery Date</FieldLabel>
                  <EditableInput
                    type="date"
                    value={expectedDate}
                    onChange={(e) => setExpectedDate(e.target.value)}
                  />
                </div>
                <div className="lg:col-span-2">
                  <FieldLabel>Notes</FieldLabel>
                  <EditableTextarea
                    value={notes ?? ''}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder="Optional notes..."
                  />
                </div>
              </FieldGrid>
            </SectionCard>

            <div className="flex justify-end">
              <StepButton onClick={() => setActiveTab('items')}>
                Order Items <ChevronRight size={16} />
              </StepButton>
            </div>
          </TabPanel>
        )}

        {/* Tab 2: Order Items */}
        {activeTab === 'items' && (
          <TabPanel>
            <SectionCard
              icon={<Package size={13} />}
              title="Order Items"
              action={
                <button
                  type="button"
                  onClick={() => openEditor(-1)}
                  className="inline-flex items-center gap-1 rounded-lg bg-[#1a9e52] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#158042]"
                >
                  <PlusIcon size={12} /> Add Item
                </button>
              }
            >
              {items.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-slate-400">
                  No items yet
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs font-mono">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="py-2 pr-3 text-left font-medium">Product</th>
                        <th className="py-2 pr-3 text-right font-medium">Qty</th>
                        <th className="py-2 pr-3 text-left font-medium">UOM</th>
                        <th className="py-2 pr-3 text-right font-medium">
                          Unit Price
                        </th>
                        <th className="py-2 pr-3 text-right font-medium">Disc %</th>
                        <th className="py-2 pr-3 text-right font-medium">Tax %</th>
                        <th className="py-2 pr-3 text-right font-medium">
                          Line Total
                        </th>
                        <th className="py-2 text-right font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((line, idx) => {
                        const lineTotal =
                          line.ordered_qty *
                          line.unit_price *
                          (1 - line.discount / 100) *
                          (1 + line.tax / 100);
                        return (
                          <tr
                            key={line.key}
                            onClick={() => openEditor(idx)}
                            title="Edit this line"
                            className="cursor-pointer border-b last:border-b-0 hover:bg-muted/30"
                          >
                            <td className="py-2 pr-3 font-medium">
                              <span className="inline-flex items-center gap-1.5">
                                {line.product_name || '—'}
                              </span>
                            </td>
                            <td className="py-2 pr-3 text-right">
                              {line.ordered_qty}
                            </td>
                            <td className="py-2 pr-3">{line.uom || '—'}</td>
                            <td className="py-2 pr-3 text-right">
                              {fmt(line.unit_price)}
                            </td>
                            <td className="py-2 pr-3 text-right">
                              {line.discount}
                            </td>
                            <td className="py-2 pr-3 text-right">{line.tax}</td>
                            <td className="py-2 pr-3 text-right font-semibold">
                              {fmt(lineTotal)}
                            </td>
                            <td className="py-2 text-right">
                              {/* stopPropagation: the row itself opens the
                                  editor, so a delete click must not also. */}
                              <div className="flex justify-end gap-1.5">
                                <button
                                  type="button"
                                  title="Remove item"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setItems((p) =>
                                      p.filter((_, i) => i !== idx),
                                    );
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
              )}
            </SectionCard>

            <div className="flex justify-start">
              <StepButton onClick={() => setActiveTab('details')}>
                <ArrowLeftIcon size={16} /> Details
              </StepButton>
            </div>
          </TabPanel>
        )}
      </FormLayout>

      {/* ── Line editor ── */}
      <LineItemDialog
        open={editorIndex !== null}
        onOpenChange={(o) => !o && setEditorIndex(null)}
        mode={editorIndex === -1 ? 'create' : 'edit'}
        error={lineError}
        confirmDisabled={!draft.item_id}
        onConfirm={commitLine}
        context={
          <>
            <LineDialogFact icon={<ReceiptText size={13} />}>
              {partner?.name || 'No partner selected'}
            </LineDialogFact>
            {warehouseName && (
              <LineDialogFact icon={<Package size={13} />}>
                {warehouseName}
              </LineDialogFact>
            )}
          </>
        }
      >
        <div className="relative">
          <AsyncSearchSelect
            label="Product *"
            placeholder="Select product..."
            apiUrl={`${API.inventory.item.root}?sellable=true`}
            value={draft.item_id}
            selectedLabel={draft.product_name}
            enablePopupSearch
            onChangeAction={onPickItem}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Defaults to the item's base UOM; any other unit the item
              defines can be chosen. */}
          <ItemUomSelect
            itemId={draft.item_id}
            value={draft.item_uom_id}
            onChangeAction={(sel) => {
              // The item's price is per base unit, so switching to a Box of
              // 12 turns $5/Piece into $60/Box. Without rescaling the line
              // would bill Box quantities at Piece prices.
              const from = draft.base_factor ?? 1;
              const to = sel.baseFactor || 1;
              patchDraft({
                item_uom_id: sel.itemUomId,
                uom: sel.name,
                base_factor: to,
                unit_price: roundQty((draft.unit_price / from) * to, 4),
              });
            }}
          />
          <div>
            <FieldLabel required>Qty</FieldLabel>
            <EditableInput
              value={draft.ordered_qty}
              onChange={(e) =>
                patchDraft({ ordered_qty: Number(e.target.value) })
              }
            />
          </div>
          <div>
            <FieldLabel required>Unit Price</FieldLabel>
            <EditableInput
              value={draft.unit_price}
              onChange={(e) =>
                patchDraft({ unit_price: Number(e.target.value) })
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel>Disc %</FieldLabel>
              <EditableInput
                step="0.01"
                value={draft.discount}
                onChange={(e) =>
                  patchDraft({ discount: Number(e.target.value) })
                }
              />
            </div>
            <div>
              <FieldLabel>Tax %</FieldLabel>
              <EditableInput
                value={draft.tax}
                onChange={(e) => patchDraft({ tax: Number(e.target.value) })}
              />
            </div>
          </div>
        </div>
      </LineItemDialog>
    </div>
  );
}
