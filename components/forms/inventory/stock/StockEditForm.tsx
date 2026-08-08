'use client';

import AsyncSearchSelect from '@/components/ui/AsyncSearchSelect';
import {
  EditableInput,
  EditableTextarea,
  FieldLabel,
} from '@/components/ui/FieldLabel';
import { FormHeader, HeaderAction } from '@/components/ui/FormShell';
import { ReadonlyInput } from '@/components/ui/Readonly';
import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  Building2,
  CalendarDays,
  ChevronRight,
  Clock,
  Loader2,
  Package,
  Percent,
  RotateCcw,
  Ruler,
  ShieldCheck,
  Tag,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { API } from '@/lib/constant';
import type { ConversionType } from '@/service/core/uom-conversion';
import ItemUomDetails, {
  validateUomRows,
  type ItemUomDraft,
} from './ItemUomDetails';

/** The view page this form returns to on Discard or after saving. */
const VIEW_HREF = (id: number) =>
  `/inventory/configurations/stock-item/${id}/view`;

/** Lets the header's Save button submit the grid <form> it cannot sit inside. */
const FORM_ID = 'stock-item-edit-form';

export type StockEditItem = {
  id: number;
  name: string;
  reference_no: string | null;
  sku: string | null;
  description: string | null;
  item_class: string;
  price: number;
  min_price: number | null;
  max_price: number | null;
  cost: number | null;
  is_variant: boolean;
  is_discount: boolean;
  is_sellable: boolean;
  is_returnable: boolean;
  is_warranty: boolean;
  track_serial?: boolean;
  serial_generation?: 'manual' | 'auto' | 'both';
  warranty_duration: string | null;
  category_id: number | null;
  uom_id: number | null;
  default_warehouse_id: number | null;
  default_location_id: number | null;
  default_warehouse: { id: number; name: string } | null;
  default_location: { id: number; name: string } | null;
  created_at: string;
  category: { id: number; name: string; reference_no?: string } | null;
  uom: { id: number; name: string } | null;
  company: { id: number; name: string } | null;
};

const TABS = [
  { id: 'details' as const, label: 'Details', num: 1 },
  { id: 'pricing' as const, label: 'Pricing', num: 2 },
  { id: 'options' as const, label: 'More Options', num: 3 },
  { id: 'uoms' as const, label: 'UOM Details', num: 4 },
];
type TabId = (typeof TABS)[number]['id'];

function ToggleCheckbox({
  checked,
  onChange,
  icon,
  label,
  description,
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
  icon: React.ReactNode;
  label: string;
  description: string;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-all ${
        checked
          ? 'border-blue-200 bg-blue-50/60 shadow-sm'
          : 'border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50/50'
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <div
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all ${
          checked
            ? 'border-blue-500 bg-blue-500 text-white'
            : 'border-slate-300 bg-white'
        }`}
      >
        {checked && (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M2.5 6L5 8.5L9.5 3.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={checked ? 'text-blue-600' : 'text-slate-400'}>
            {icon}
          </span>
          <span
            className={`text-xs ${checked ? 'text-blue-800' : 'text-slate-700'}`}
          >
            {label}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-slate-400">{description}</p>
      </div>
    </label>
  );
}

export default function StockEditForm({ item }: { item: StockEditItem }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>('details');
  // The item's alternate units. Loaded separately because they live in their
  // own table and are saved through their own endpoint.
  const [uomRows, setUomRows] = useState<ItemUomDraft[]>([]);
  const [uomsLoaded, setUomsLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const createdAt = new Date(item.created_at);

  const [formData, setFormData] = useState({
    name: item.name ?? '',
    sku: item.sku ?? '',
    description: item.description ?? '',
    price: item.price ?? 0,
    cost: item.cost ?? 0,
    min_price: item.min_price ?? ('' as number | ''),
    max_price: item.max_price ?? ('' as number | ''),
    category_id: item.category_id,
    category: item.category ?? { id: null, name: '' },
    uom_id: item.uom_id,
    uom: item.uom ?? { id: null, name: '' },
    is_discount: item.is_discount,
    is_variant: item.is_variant,
    is_sellable: item.is_sellable,
    is_returnable: item.is_returnable,
    is_warranty: item.is_warranty || !!item.warranty_duration,
    track_serial: Boolean(
      (item as StockEditItem & { track_serial?: boolean }).track_serial,
    ),
    serial_generation:
      (item as StockEditItem & { serial_generation?: 'manual' | 'auto' | 'both' })
        .serial_generation ?? 'both',
    warranty_duration: item.warranty_duration ?? '',
    default_warehouse_id: item.default_warehouse_id ?? null,
    default_warehouse: item.default_warehouse ?? null,
    default_location_id: item.default_location_id ?? null,
    default_location: item.default_location ?? null,
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'price' || name === 'cost' ? Number(value) : value,
    }));
  };

  // Load the item's UOM rows. A row already referenced by a document is
  // locked: its unit is immutable because posted lines resolve through it.
  useEffect(() => {
    let active = true;
    fetch(`${API.inventory.itemUom.root}?item_id=${item.id}&limit=100`)
      .then((r) => r.json())
      .then((json) => {
        if (!active) return;
        const rows = (json.data ?? []) as Array<{
          id: number;
          uom_id: number;
          conversion: number | null;
          conversion_type: ConversionType | null;
          is_default: boolean;
          uom?: { name?: string } | null;
          name?: string;
        }>;
        setUomRows(
          rows.map((r) => ({
            key: `u${r.id}`,
            id: r.id,
            uom_id: r.uom_id,
            uom_name: r.uom?.name ?? '',
            conversion: Number(r.conversion ?? 1),
            conversion_type: (r.conversion_type ?? 'MULTIPLY') as ConversionType,
            is_default: r.is_default,
          })),
        );
      })
      .catch(() => undefined)
      .finally(() => active && setUomsLoaded(true));
    return () => {
      active = false;
    };
  }, [item.id]);

  /**
   * Persist the UOM rows alongside the item.
   *
   * They live in their own table with their own endpoint, so this diffs the
   * editor's rows against what was loaded: new rows are created, changed
   * conversions patched, removed rows deleted. A delete the server refuses
   * (because documents reference it) surfaces as an error rather than silently
   * dropping the row.
   */
  const saveUomRows = async () => {
    const existing = new Map(
      uomRows.filter((r) => r.id).map((r) => [r.id as number, r]),
    );
    const base = API.inventory.itemUom.root;

    // Created + updated
    for (const row of uomRows) {
      if (row.is_default || !row.uom_id) continue;
      if (!row.id) {
        const res = await fetch(base, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: row.uom_name,
            item_id: item.id,
            uom_id: row.uom_id,
            is_default: false,
            conversion: row.conversion,
            conversion_type: row.conversion_type,
            factor: row.conversion,
          }),
        });
        if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to add UOM');
      } else {
        const res = await fetch(`${base}/${row.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversion: row.conversion,
            conversion_type: row.conversion_type,
          }),
        });
        if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to update UOM');
      }
    }

    // Deleted
    for (const [id] of existing) {
      if (uomRows.some((r) => r.id === id)) continue;
      const res = await fetch(`${base}/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to remove UOM');
    }
  };

  const handleSave = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setError('');

    const uomError = validateUomRows(uomRows);
    if (uomError) {
      setActiveTab('uoms');
      setError(uomError);
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name: formData.name,
        sku: formData.sku || null,
        description: formData.description || null,
        price: formData.price,
        cost: formData.cost || null,
        min_price:
          formData.min_price === '' ? null : Number(formData.min_price),
        max_price:
          formData.max_price === '' ? null : Number(formData.max_price),
        category_id: formData.category_id,
        uom_id: formData.uom_id,
        is_discount: formData.is_discount,
        is_variant: formData.is_variant,
        is_sellable: formData.is_sellable,
        is_returnable: formData.is_returnable,
        is_warranty: formData.is_warranty,
        track_serial: formData.track_serial,
        serial_generation: formData.serial_generation,
        warranty_duration: formData.is_warranty
          ? formData.warranty_duration || null
          : null,
        default_warehouse_id: formData.default_warehouse_id,
        default_location_id: formData.default_location_id,
      };

      const res = await fetch(
        `/api/inventory/configurations/stock-item/${item.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error?.message ?? json.error ?? 'Update failed');
      }

      // Alternate units are saved after the item, so a rejected base-UOM
      // change (an item with stock history) fails before they are touched.
      await saveUomRows();

      router.push(`/inventory/configurations/stock-item/${item.id}/view`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  const profit = Number(formData.price) - Number(formData.cost);
  const profitMargin =
    Number(formData.price) > 0
      ? ((profit / Number(formData.price)) * 100).toFixed(1)
      : '0.0';

  return (
    <div className="space-y-4 font-mono">
      {/* Header — Discard and Save live here rather than under the sidebar,
          matching every other document screen. Discard replaces the old back
          link, which pointed at /inventory/configurations/stock/:id/view: not
          a module, so it 404'd. */}
      <FormHeader
        icon={<Package size={24} />}
        title={item.name}
        subtitle={item.sku ?? item.reference_no ?? undefined}
        actions={
          <>
            <HeaderAction label="Discard" href={VIEW_HREF(item.id)} />
            <HeaderAction
              label={isSaving ? 'Saving' : 'Save'}
              icon={
                isSaving ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : undefined
              }
              tone="primary"
              type="submit"
              form={FORM_ID}
              disabled={isSaving}
            />
          </>
        }
      />

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-500" />
          <p className="text-sm text-red-700">{error}</p>
          <button
            type="button"
            onClick={() => setError('')}
            className="ml-auto shrink-0 text-red-400 hover:text-red-600"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <form
        id={FORM_ID}
        onSubmit={handleSave}
        className="grid gap-6 xl:grid-cols-[350px_minmax(0,1fr)] text-xs"
      >
        {/* LEFT SIDEBAR */}
        <aside className="space-y-4 self-start xl:sticky xl:top-6">
          <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-50 bg-slate-50/80 px-4 py-2.5">
              <Building2 size={13} className="text-[#1a9e52]" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Item Info
              </span>
            </div>
            <div className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-[#1a9e52] to-emerald-700 text-sm font-bold text-white shadow-sm">
                  {item.name?.[0]?.toUpperCase() ?? 'I'}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">
                    {item.name}
                  </p>
                  <span className="inline-flex items-center rounded-full bg-[#1a9e52]/10 px-2 py-0.5 text-[10px] font-semibold capitalize text-[#1a9e52]">
                    {item.company?.name ?? 'N/A'}
                  </span>
                </div>
              </div>
              <div className="mt-3 space-y-1.5 rounded-xl bg-slate-50 p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <Building2 size={11} /> Company
                  </span>
                  <span className="font-semibold text-slate-700">
                    {item.company?.name ?? '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <CalendarDays size={11} /> Created
                  </span>
                  <span className="font-semibold text-slate-700">
                    {createdAt.toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <Clock size={11} /> Time
                  </span>
                  <span className="font-semibold text-slate-700">
                    {createdAt.toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            </div>
          </section>
        </aside>

        {/* RIGHT — Tabs */}
        <div className="min-w-0 text-xs">
          <div className="flex gap-0 border-b border-slate-200">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 border-b-2 px-5 py-3 transition-all ${
                  activeTab === tab.id
                    ? 'border-[#1a9e52] text-[#1a9e52]'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold transition-all ${
                    activeTab === tab.id
                      ? 'bg-[#1a9e52] text-white'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {tab.num}
                </span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab 1: Details */}
          {activeTab === 'details' && (
            <div className="space-y-5 pt-5">
              <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                <h3 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <Package size={13} className="text-[#1a9e52]" /> Item
                  Information
                </h3>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div>
                    <FieldLabel>Reference No</FieldLabel>
                    <ReadonlyInput
                      value={item.reference_no ?? ''}
                      placeholder="Auto-generated"
                    />
                  </div>
                  <div>
                    <FieldLabel required>Item Name</FieldLabel>
                    <EditableInput
                      type="text"
                      name="name"
                      required
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="e.g. iPhone 16 Pro Max"
                    />
                  </div>
                  <div>
                    <FieldLabel>Barcode / SKU</FieldLabel>
                    <EditableInput
                      type="text"
                      name="sku"
                      value={formData.sku}
                      onChange={handleChange}
                      placeholder="Scan or type barcode..."
                    />
                  </div>
                  <div>
                    <AsyncSearchSelect
                      label="Category"
                      placeholder="Select category..."
                      apiUrl="/api/inventory/configurations/category"
                      value={formData.category_id}
                      selectedLabel={formData.category?.name ?? ''}
                      popupTitle="Category"
                      enablePopupSearch
                      onChangeAction={(selected) =>
                        setFormData((prev) => ({
                          ...prev,
                          category_id: selected?.id
                            ? Number(selected.id)
                            : null,
                          category: {
                            id: selected?.id ? Number(selected.id) : null,
                            name: selected?.name ?? '',
                          },
                        }))
                      }
                      required
                    />
                  </div>
                  <div>
                    <AsyncSearchSelect
                      label="Base UOM"
                      placeholder="Select unit of measure..."
                      apiUrl="/api/inventory/configurations/uom?status=active"
                      value={formData.uom_id}
                      selectedLabel={formData.uom?.name ?? ''}
                      popupTitle="Base UOM"
                      enablePopupSearch
                      onChangeAction={(selected) =>
                        setFormData((prev) => ({
                          ...prev,
                          uom_id: selected?.id ? Number(selected.id) : null,
                          uom: {
                            id: selected?.id ? Number(selected.id) : null,
                            name: selected?.name ?? '',
                          },
                        }))
                      }
                    />
                  </div>
                  <div>
                    <AsyncSearchSelect
                      label="Default Warehouse"
                      placeholder="Item default warehouse"
                      apiUrl="/api/inventory/configurations/warehouse"
                      value={formData.default_warehouse_id}
                      selectedLabel={formData.default_warehouse?.name ?? ''}
                      enablePopupSearch
                      onChangeAction={(selected) =>
                        setFormData((prev) => ({
                          ...prev,
                          default_warehouse_id: selected?.id
                            ? Number(selected.id)
                            : null,
                          default_warehouse: selected
                            ? {
                                id: Number(selected.id),
                                name: selected.name ?? '',
                              }
                            : null,
                          default_location_id: null,
                          default_location: null,
                        }))
                      }
                    />
                  </div>
                  <div>
                    {formData.default_warehouse_id ? (
                      <AsyncSearchSelect
                        key={formData.default_warehouse_id}
                        label="Default Location"
                        placeholder="Select location..."
                        apiUrl={`/api/inventory/configurations/warehouse/${formData.default_warehouse_id}/locations`}
                        value={formData.default_location_id}
                        selectedLabel={formData.default_location?.name ?? ''}
                        enablePopupSearch
                        onChangeAction={(selected) =>
                          setFormData((prev) => ({
                            ...prev,
                            default_location_id: selected?.id
                              ? Number(selected.id)
                              : null,
                            default_location: selected
                              ? {
                                  id: Number(selected.id),
                                  name: selected.name ?? '',
                                }
                              : null,
                          }))
                        }
                      />
                    ) : (
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-600">
                          Default Location
                        </label>
                        <div className="w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-400">
                          Select a warehouse first
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-4">
                  <FieldLabel>Description</FieldLabel>
                  <EditableTextarea
                    name="description"
                    value={formData.description ?? ''}
                    onChange={handleChange}
                    placeholder="Additional notes..."
                    rows={3}
                  />
                </div>
              </section>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setActiveTab('pricing')}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-2.5 text-xs text-slate-600 transition-colors hover:bg-slate-50"
                >
                  Pricing <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Tab 2: Pricing */}
          {activeTab === 'pricing' && (
            <div className="space-y-5 pt-5">
              <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                <h3 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <Tag size={13} className="text-[#1a9e52]" /> Pricing
                </h3>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <FieldLabel>Cost ($)</FieldLabel>
                    <EditableInput
                      name="cost"
                      type="number"
                      min={0}
                      step="0.01"
                      value={formData.cost}
                      onChange={handleChange}
                    />
                  </div>
                  <div>
                    <FieldLabel required>Sale Price ($)</FieldLabel>
                    <EditableInput
                      name="price"
                      type="number"
                      min={0}
                      step="0.01"
                      value={formData.price}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div>
                    <FieldLabel>Profit</FieldLabel>
                    <div
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 font-semibold ${
                        profit > 0
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : profit < 0
                            ? 'border-red-200 bg-red-50 text-red-600'
                            : 'border-slate-200 bg-slate-50 text-slate-500'
                      }`}
                    >
                      <BarChart3 size={14} />${profit.toFixed(2)}
                      <span className="text-xs font-normal opacity-70">
                        ({profitMargin}%)
                      </span>
                    </div>
                  </div>
                  <div>
                    <FieldLabel>Min Price ($)</FieldLabel>
                    <EditableInput
                      name="min_price"
                      type="number"
                      min={0}
                      step="0.01"
                      value={formData.min_price}
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          min_price:
                            e.target.value === '' ? '' : Number(e.target.value),
                        }))
                      }
                      placeholder="—"
                    />
                  </div>
                  <div>
                    <FieldLabel>Max Price ($)</FieldLabel>
                    <EditableInput
                      name="max_price"
                      type="number"
                      min={0}
                      step="0.01"
                      value={formData.max_price}
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          max_price:
                            e.target.value === '' ? '' : Number(e.target.value),
                        }))
                      }
                      placeholder="—"
                    />
                  </div>
                </div>
              </section>

              <div className="flex justify-between">
                <button
                  type="button"
                  onClick={() => setActiveTab('details')}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-2.5 text-slate-600 transition-colors hover:bg-slate-50"
                >
                  <ArrowLeft size={16} /> Details
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('options')}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-2.5 text-slate-600 transition-colors hover:bg-slate-50"
                >
                  More Options <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Tab 3: More Options */}
          {activeTab === 'options' && (
            <div className="space-y-5 pt-5">
              <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                <h3 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <ShieldCheck size={13} className="text-[#1a9e52]" /> Item
                  Properties
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <ToggleCheckbox
                    checked={formData.is_warranty}
                    onChange={(val) =>
                      setFormData((p) => ({ ...p, is_warranty: val }))
                    }
                    icon={<ShieldCheck size={16} />}
                    label="Has Warranty"
                    description="This item comes with a warranty"
                  />
                  <div className="space-y-2">
                    <ToggleCheckbox
                      checked={formData.track_serial}
                      onChange={(val) =>
                        setFormData((p) => ({ ...p, track_serial: val }))
                      }
                      icon={<Package size={16} />}
                      label="Track Serial Numbers"
                      description="Require serial number entry for receipts and shipments"
                    />
                    {formData.track_serial && (
                      <select
                        value={formData.serial_generation ?? 'both'}
                        onChange={(e) =>
                          setFormData((p) => ({
                            ...p,
                            serial_generation: e.target.value as
                              | 'manual'
                              | 'auto'
                              | 'both',
                          }))
                        }
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                      >
                        <option value="both">
                          Serial entry: Manual or Generate
                        </option>
                        <option value="manual">Serial entry: Manual only</option>
                        <option value="auto">Serial entry: Generate only</option>
                      </select>
                    )}
                  </div>
                  <ToggleCheckbox
                    checked={formData.is_discount}
                    onChange={(val) =>
                      setFormData((p) => ({ ...p, is_discount: val }))
                    }
                    icon={<Percent size={16} />}
                    label="Discountable"
                    description="Allow discounts on this item"
                  />
                  <ToggleCheckbox
                    checked={formData.is_returnable}
                    onChange={(val) =>
                      setFormData((p) => ({ ...p, is_returnable: val }))
                    }
                    icon={<RotateCcw size={16} />}
                    label="Returnable"
                    description="Allow customer returns"
                  />
                  {/* <ToggleCheckbox
                    checked={formData.is_sellable}
                    onChange={(val) =>
                      setFormData((p) => ({ ...p, is_sellable: val }))
                    }
                    icon={<Tag size={16} />}
                    label="Sellable"
                    description="Show in POS for sale"
                  /> */}
                </div>
                {formData.is_warranty && (
                  <div className="mt-4">
                    <FieldLabel>Warranty Duration</FieldLabel>
                    <EditableInput
                      type="text"
                      name="warranty_duration"
                      value={formData.warranty_duration}
                      onChange={handleChange}
                      placeholder="e.g. 1 year, 6 months..."
                    />
                  </div>
                )}
              </section>

              <div className="flex justify-between">
                <button
                  type="button"
                  onClick={() => setActiveTab('pricing')}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-2.5 text-xs text-slate-600 transition-colors hover:bg-slate-50"
                >
                  <ArrowLeft size={16} /> Pricing
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('uoms')}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-2.5 text-xs text-slate-600 transition-colors hover:bg-slate-50"
                >
                  UOM Details <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Tab 4: UOM Details */}
          {activeTab === 'uoms' && (
            <div className="space-y-5 pt-5">
              <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                <h3 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <Ruler size={13} className="text-[#1a9e52]" /> UOM Details
                </h3>
                {uomsLoaded ? (
                  <ItemUomDetails
                    baseUomName={formData.uom?.name ?? ''}
                    rows={uomRows}
                    onChangeAction={setUomRows}
                  />
                ) : (
                  <p className="py-8 text-center text-slate-400">Loading…</p>
                )}
              </section>

              <div className="flex justify-start">
                <button
                  type="button"
                  onClick={() => setActiveTab('options')}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-2.5 text-xs text-slate-600 transition-colors hover:bg-slate-50"
                >
                  <ArrowLeft size={16} /> More Options
                </button>
              </div>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
