'use client';

import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { ReadonlyInput } from '@/components/ui/Readonly';
import type { ItemStockBalance } from '@/service/apps/inventory/repo/stock-balance';
import type {
  TStockBalanceRow,
  TStockLocationSummary,
} from '@/types/inventory/item';
import {
  ArrowLeft,
  BarChart3,
  Building2,
  CalendarDays,
  ChevronRight,
  Clock,
  Edit2,
  Layers,
  Loader2,
  MapPin,
  Package,
  Percent,
  RotateCcw,
  ScanBarcode,
  ShieldCheck,
  Tag,
  Truck,
  Warehouse,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export type StockViewItem = {
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
  warranty_duration: string | null;
  category_id: number | null;
  uom_id: number | null;
  user_id: string | null;
  company_id: number | null;
  created_at: string;
  updated_at: string;
  default_warehouse_id: number | null;
  default_location_id: number | null;
  default_warehouse: { id: number; name: string } | null;
  default_location: { id: number; name: string } | null;
  category: { id: number; name: string; reference_no: string } | null;
  uom: { id: number; name: string } | null;
  company: { id: number; name: string } | null;
  stock_location?: TStockLocationSummary | null;
  stock_balances?: TStockBalanceRow[];
};

const TABS = [
  { id: 'details' as const, label: 'Details', num: 1 },
  { id: 'pricing' as const, label: 'Pricing Details', num: 2 },
  { id: 'options' as const, label: 'More Options', num: 3 },
  { id: 'inventory' as const, label: 'Inventory', num: 4 },
];
type TabId = (typeof TABS)[number]['id'];

const INVENTORY_COLUMNS: DataTableColumn<ItemStockBalance>[] = [
  {
    key: 'warehouse',
    header: 'Warehouse',
    cell: (row) => (
      <div className="flex items-center gap-2">
        <span className="font-medium text-slate-800">
          {row.warehouse_name ?? '—'}
        </span>
        {row.warehouse_is_default && (
          <span className="rounded-full bg-[#1a9e52]/10 px-2 py-0.5 text-[10px] font-semibold text-[#1a9e52]">
            Default
          </span>
        )}
      </div>
    ),
  },
  {
    key: 'location',
    header: 'Location',
    cell: (row) => (
      <div className="flex items-center gap-2">
        <MapPin size={13} className="shrink-0 text-slate-400" />
        <span>{row.location_name ?? '—'}</span>
        {row.location_code && (
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-500">
            {row.location_code}
          </span>
        )}
        {row.location_is_default && (
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-600">
            Default
          </span>
        )}
      </div>
    ),
  },
  {
    key: 'quantity',
    header: 'Qty on Hand',
    headerClassName: 'text-right',
    cellClassName: 'text-right',
    cell: (row) => (
      <span
        className={`text-sm font-bold ${
          row.quantity > 0 ? 'text-slate-800' : 'text-red-400'
        }`}
      >
        {row.quantity}
      </span>
    ),
  },
];

function ReadonlyToggle({
  checked,
  icon,
  label,
  description,
}: {
  checked: boolean;
  icon: React.ReactNode;
  label: string;
  description: string;
}) {
  return (
    <div
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${
        checked
          ? 'border-blue-200 bg-blue-50/60 shadow-sm'
          : 'border-slate-100 bg-white'
      }`}
    >
      <div
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${
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
            className={`text-sm font-semibold ${checked ? 'text-blue-800' : 'text-slate-700'}`}
          >
            {label}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-slate-400">{description}</p>
      </div>
    </div>
  );
}

export default function StockViewDetail({ item }: { item: StockViewItem }) {
  const [activeTab, setActiveTab] = useState<TabId>('details');
  const [inventory, setInventory] = useState<ItemStockBalance[] | null>(null);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryError, setInventoryError] = useState('');

  useEffect(() => {
    if (activeTab !== 'inventory' || inventory !== null) return;
    setInventoryLoading(true);
    setInventoryError('');
    fetch(`/api/inventory/stock-balance/item/${item.id}`)
      .then((r) => r.json())
      .then((json) => setInventory(json.data ?? []))
      .catch(() => setInventoryError('Failed to load inventory balances.'))
      .finally(() => setInventoryLoading(false));
  }, [activeTab, item.id, inventory]);

  const profit = (item.price ?? 0) - (item.cost ?? 0);
  const profitMargin =
    (item.price ?? 0) > 0
      ? ((profit / (item.price ?? 1)) * 100).toFixed(1)
      : '0.0';
  const createdAt = new Date(item.created_at);

  return (
    <div className="mx-auto space-y-2 font-mono">
      {/* Header */}
      <div className='font-bold'>
        <Link
          href="/inventory/configurations/stock"
          className="inline-flex items-center gap-2 text-sm text-slate-500 transition-colors hover:text-slate-700"
        >
          <ArrowLeft size={16} /> Back
        </Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-[350px_minmax(0,1fr)]">
        {/* ══════════════════════════════════
                    LEFT SIDEBAR
                   ══════════════════════════════════ */}
        <aside className="space-y-4 self-start xl:sticky xl:top-6">
          {/* Item Info */}
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

          {/* Action Buttons */}
          <div className="flex flex-col-reverse gap-2">
            <Link
              href="/inventory/configurations/stock-item"
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-center text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
            >
              Back
            </Link>
            <Link
              href={`/inventory/configurations/stock-item/${item.id}/update`}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1a9e52] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#158042]"
            >
              <Edit2 size={15} /> Update
            </Link>
          </div>
        </aside>

        {/* ══════════════════════════════════
                    RIGHT — Tabs + Content
                   ══════════════════════════════════ */}
        <div>
          {/* Tab nav */}
          <div className="flex gap-0 border-b border-slate-200 text-xs">
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
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── Tab 1: Details ── */}
          {activeTab === 'details' && (
            <div className="space-y-5 pt-5 text-xs">
              <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                <div className="grid gap-4 lg:grid-cols-2">
                  <div>
                    <FieldLabel className="">Reference No</FieldLabel>
                    <ReadonlyInput
                      value={item.reference_no ?? ''}
                      placeholder="—"
                    />
                  </div>
                  <div>
                    <FieldLabel>Item Name</FieldLabel>
                    <ReadonlyInput value={item.name} />
                  </div>
                  <div>
                    <FieldLabel>Category</FieldLabel>
                    <ReadonlyInput
                      value={item.category?.name ?? ''}
                      placeholder="—"
                    />
                  </div>
                  <div>
                    <FieldLabel>Default UOM</FieldLabel>
                    <ReadonlyInput
                      value={item.uom?.name ?? ''}
                      placeholder="—"
                    />
                  </div>
                  <div>
                    <FieldLabel>Barcode / SKU</FieldLabel>
                    <div className="relative">
                      <ReadonlyInput value={item.sku ?? ''} placeholder="—" />
                      <ScanBarcode
                        size={16}
                        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-300"
                      />
                    </div>
                  </div>
                  <div>
                    <FieldLabel>Item Class</FieldLabel>
                    <ReadonlyInput value={item.item_class} />
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                <h3 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <Warehouse size={13} className="text-[#1a9e52]" /> Warehouse &amp; Location
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <FieldLabel>Default Warehouse</FieldLabel>
                    <div className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-700">
                      <Warehouse size={13} className="shrink-0 text-[#1a9e52]" />
                      {item.default_warehouse?.name ?? (
                        <span className="text-slate-400">—</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <FieldLabel>Default Location</FieldLabel>
                    <div className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-700">
                      <MapPin size={13} className="shrink-0 text-[#1a9e52]" />
                      {item.default_location?.name ?? (
                        <span className="text-slate-400">—</span>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                <FieldLabel>Additional Notes</FieldLabel>
                <div className="mt-1 min-h-24 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 whitespace-pre-wrap">
                  {item.description || (
                    <span className="text-slate-300">—</span>
                  )}
                </div>
              </section>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setActiveTab('pricing')}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
                >
                  Pricing Details <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* ── Tab 2: Pricing Details ── */}
          {activeTab === 'pricing' && (
            <div className="space-y-5 pt-5">
              <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                <h3 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <Tag size={13} className="text-[#1a9e52]" /> តម្លៃ
                </h3>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <FieldLabel>តម្លៃទិញចូល / Cost ($)</FieldLabel>
                    <ReadonlyInput
                      value={
                        item.cost != null
                          ? `$${Number(item.cost).toFixed(2)}`
                          : ''
                      }
                      placeholder="—"
                    />
                  </div>
                  <div>
                    <FieldLabel>តម្លៃលក់ / Sale Price ($)</FieldLabel>
                    <ReadonlyInput
                      value={`$${Number(item.price).toFixed(2)}`}
                    />
                  </div>
                  <div>
                    <FieldLabel>ប្រាក់ចំណេញ (Profit)</FieldLabel>
                    <div
                      className={`flex min-h-11.5 items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold ${
                        profit > 0
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : profit < 0
                            ? 'border-red-200 bg-red-50 text-red-600'
                            : 'border-slate-200 bg-slate-50 text-slate-500'
                      }`}
                    >
                      <BarChart3 size={14} />${profit.toFixed(2)}{' '}
                      <span className="text-xs font-normal opacity-70">
                        ({profitMargin}%)
                      </span>
                    </div>
                  </div>
                  <div>
                    <FieldLabel>តម្លៃអប្បបរមា (Min Price)</FieldLabel>
                    <ReadonlyInput
                      value={
                        item.min_price != null
                          ? `$${Number(item.min_price).toFixed(2)}`
                          : ''
                      }
                      placeholder="—"
                    />
                  </div>
                  <div>
                    <FieldLabel>តម្លៃអតិបរមា (Max Price)</FieldLabel>
                    <ReadonlyInput
                      value={
                        item.max_price != null
                          ? `$${Number(item.max_price).toFixed(2)}`
                          : ''
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
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
                >
                  <ArrowLeft size={16} /> Details
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('options')}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
                >
                  More Options <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* ── Tab 3: More Options ── */}
          {activeTab === 'options' && (
            <div className="space-y-5 pt-5">
              <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                <h3 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <ShieldCheck size={13} className="text-[#1a9e52]" />{' '}
                  លក្ខណៈសម្បត្តិទំនិញ
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <ReadonlyToggle
                    checked={item.is_warranty || !!item.warranty_duration}
                    icon={<ShieldCheck size={16} />}
                    label="Has Warranty"
                    description="Item comes with a warranty"
                  />
                  <ReadonlyToggle
                    checked={item.is_discount}
                    icon={<Percent size={16} />}
                    label="Discountable"
                    description="Allow discounts on this item"
                  />
                  <ReadonlyToggle
                    checked={item.is_returnable}
                    icon={<RotateCcw size={16} />}
                    label="Returnable"
                    description="Allow customer returns"
                  />
                  <ReadonlyToggle
                    checked={item.is_sellable}
                    icon={<Tag size={16} />}
                    label="Sellable"
                    description="Show in POS for sale"
                  />
                </div>
                {item.warranty_duration && (
                  <div className="mt-4">
                    <FieldLabel>រយៈពេលធានា (Warranty Duration)</FieldLabel>
                    <ReadonlyInput value={item.warranty_duration} />
                  </div>
                )}
              </section>

              <div className="flex justify-start">
                <button
                  type="button"
                  onClick={() => setActiveTab('pricing')}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
                >
                  <ArrowLeft size={16} /> Pricing Details
                </button>
              </div>
            </div>
          )}

          {/* ── Tab 4: Inventory ── */}
          {activeTab === 'inventory' && (
            <div className="space-y-5 pt-5">
              <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                <h3 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <Layers size={13} className="text-[#1a9e52]" /> Stock Balances
                  by Location
                </h3>

                {inventoryLoading && (
                  <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-400">
                    <Loader2 size={16} className="animate-spin" />
                    Loading inventory...
                  </div>
                )}

                {inventoryError && !inventoryLoading && (
                  <p className="py-6 text-center text-sm text-red-500">
                    {inventoryError}
                  </p>
                )}

                {!inventoryLoading && !inventoryError && inventory !== null && (
                  <DataTable
                    columns={INVENTORY_COLUMNS}
                    data={inventory}
                    keyExtractor={(row) => row.id}
                    searchFn={(row, q) =>
                      (row.warehouse_name ?? '').toLowerCase().includes(q) ||
                      (row.location_name ?? '').toLowerCase().includes(q) ||
                      (row.location_code ?? '').toLowerCase().includes(q)
                    }
                    searchPlaceholder="Search warehouse or location..."
                    emptyIcon={<Layers size={32} />}
                    emptyTitle="No stock balances found"
                    emptyDescription="This item has no recorded stock in any location."
                    pageSize={0}
                  />
                )}
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
