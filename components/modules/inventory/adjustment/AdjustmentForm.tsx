'use client';

import AsyncSearchSelect from '@/components/ui/AsyncSearchSelect';
import SerialEntryPanel from '@/components/ui/serial/SerialEntryPanel';
import SerialLookupPanel from '@/components/ui/serial/SerialLookupPanel';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { API } from '@/lib/constant';
import { stockAdjustmentApi } from '@/lib/api/adjustment';
import { useItemAutoFill } from '@/hook/useItemAutoFill';
import type {
  AdjustmentReason,
  StockAdjustment,
  StockAdjustmentLinePayload,
} from '@/types/inventory/adjustment';
import {
  AlertCircle,
  ArrowLeftIcon,
  ArrowLeftRight,
  Loader2Icon,
  LocationEdit,
  MapPin,
  PencilIcon,
  PlusIcon,
  SaveIcon,
  Trash2Icon,
  Warehouse,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

// ─── Stock Adjustment form (create + edit) ──────────────────────────────────
// Presentation + payload assembly only. All stock effects happen server-side
// at POST time through the movement engine — saving a draft touches nothing.

type LineDraft = {
  id?: number;
  item_id: number;
  item_label: string;
  track_serial: boolean;
  serial_generation: 'manual' | 'auto' | 'both';
  item_uom_id: number | null;
  uom_label: string;
  current_qty: number;
  adjustment_qty: string; // signed text input
  unit_cost: string;
  serial_numbers: string[];
  remarks: string;
};

function money(n: number) {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const EMPTY_LINE: LineDraft = {
  item_id: 0,
  item_label: '',
  track_serial: false,
  serial_generation: 'both',
  item_uom_id: null,
  uom_label: '',
  current_qty: 0,
  adjustment_qty: '',
  unit_cost: '',
  serial_numbers: [],
  remarks: '',
};

export default function AdjustmentForm({
  mode,
  initial,
}: {
  mode: 'create' | 'edit';
  initial?: StockAdjustment;
}) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);

  // ── Header state ─────────────────────────────────────────────────────
  const [referenceNo, setReferenceNo] = useState(initial?.reference_no ?? '');
  const [adjustmentDate, setAdjustmentDate] = useState(
    initial?.adjustment_date?.slice(0, 10) ?? today,
  );
  const [warehouse, setWarehouse] = useState<{
    id: number | null;
    name: string;
  }>({
    id: initial?.warehouse_id ?? null,
    name: initial?.warehouse_name ?? '',
  });
  const [location, setLocation] = useState<{ id: number | null; name: string }>(
    {
      id: initial?.location_id ?? null,
      name: initial?.location_name ?? '',
    },
  );
  const [reasonCode, setReasonCode] = useState(initial?.reason_code ?? '');
  const [remarks, setRemarks] = useState(initial?.remarks ?? '');
  const [reasons, setReasons] = useState<AdjustmentReason[]>([]);

  // ── Lines state ──────────────────────────────────────────────────────
  const [lines, setLines] = useState<LineDraft[]>(
    (initial?.items ?? []).map((i) => ({
      id: i.id,
      item_id: i.item_id,
      item_label: i.product_name,
      track_serial: i.track_serial,
      serial_generation: 'both',
      item_uom_id: i.item_uom_id,
      uom_label: i.uom,
      current_qty: i.current_qty,
      adjustment_qty: String(i.adjustment_qty),
      unit_cost: i.unit_cost != null ? String(i.unit_cost) : '',
      serial_numbers: i.serial_numbers,
      remarks: i.remarks ?? '',
    })),
  );

  // Line editor modal: null = closed; -1 = new line; ≥0 = editing index.
  const [editorIndex, setEditorIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState<LineDraft>(EMPTY_LINE);
  const [onHandLoading, setOnHandLoading] = useState(false);
  const { resolveItemDefaults } = useItemAutoFill();

  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    stockAdjustmentApi
      .reasons()
      .then(setReasons)
      .catch(() => {});
  }, []);

  // ── Line editor helpers ──────────────────────────────────────────────
  const headerReady = !!warehouse.id && !!location.id;

  function openEditor(index: number) {
    setDraft(index === -1 ? EMPTY_LINE : { ...lines[index] });
    setEditorIndex(index);
  }

  async function onPickItem(
    selected: { id: string | number | null; name: string } | null,
  ) {
    if (!selected?.id) return;
    const itemId = Number(selected.id);
    setDraft((d) => ({
      ...d,
      item_id: itemId,
      item_label: selected.name,
      item_uom_id: null,
      uom_label: '',
      serial_numbers: [],
    }));
    // Item-master defaults (track-serial, cost, UOM) + LIVE on-hand at the
    // header warehouse/location. `resolveItemDefaults` is the shared, cached
    // lookup reused by Sales Order and Receipt.
    setOnHandLoading(true);
    try {
      const [defaults, onHand] = await Promise.all([
        resolveItemDefaults(itemId),
        stockAdjustmentApi.onHand(itemId, warehouse.id!, location.id!),
      ]);
      setDraft((d) =>
        d.item_id === itemId
          ? {
              ...d,
              track_serial: defaults.trackSerial,
              serial_generation: defaults.serialGeneration,
              current_qty: onHand,
              unit_cost:
                defaults.cost != null ? String(defaults.cost) : d.unit_cost,
              item_uom_id: defaults.itemUomId ?? d.item_uom_id,
              uom_label: defaults.uomName || d.uom_label,
            }
          : d,
      );
    } finally {
      setOnHandLoading(false);
    }
  }

  const draftQty = Number(draft.adjustment_qty) || 0;
  const draftNewQty = draft.current_qty + draftQty;

  function commitLine() {
    setError('');
    if (!draft.item_id) return setError('Select an item.');
    if (!draftQty) return setError('Adjustment quantity cannot be 0.');
    if (draftQty < 0 && draft.current_qty + draftQty < 0) {
      return setError(
        `Only ${draft.current_qty} on hand — removing ${Math.abs(draftQty)} would make stock negative.`,
      );
    }
    if (
      draft.track_serial &&
      draft.serial_numbers.length !== Math.abs(draftQty)
    ) {
      return setError(
        `Exactly ${Math.abs(draftQty)} serial number(s) required for ${draft.item_label}.`,
      );
    }
    setLines((prev) =>
      editorIndex === -1
        ? [...prev, draft]
        : prev.map((l, i) => (i === editorIndex ? draft : l)),
    );
    setEditorIndex(null);
  }

  // ── Submit ───────────────────────────────────────────────────────────
  async function handleSubmit() {
    setError('');
    if (!headerReady) return setError('Select a warehouse and location.');
    if (!reasonCode) return setError('Select an adjustment reason.');
    if (lines.length === 0) return setError('Add at least one item.');

    setSaving(true);
    try {
      const items: StockAdjustmentLinePayload[] = lines.map((l) => ({
        ...(l.id ? { id: l.id } : {}),
        item_id: l.item_id,
        item_uom_id: l.item_uom_id,
        description: l.item_label,
        current_qty: l.current_qty,
        adjustment_qty: Number(l.adjustment_qty),
        unit_cost:
          Number(l.adjustment_qty) > 0 && l.unit_cost !== ''
            ? Number(l.unit_cost)
            : null,
        serial_numbers: l.serial_numbers,
        remarks: l.remarks || undefined,
      }));
      const payload = {
        reference_no: referenceNo.trim() || undefined,
        adjustment_date: adjustmentDate,
        warehouse_id: warehouse.id!,
        location_id: location.id!,
        reason_code: reasonCode,
        remarks: remarks.trim() || undefined,
        items,
      };
      const saved =
        mode === 'create'
          ? await stockAdjustmentApi.create(payload)
          : await stockAdjustmentApi.update(initial!.id, payload);
      router.push(`/inventory/stock_adjust/${saved.id}/view`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save adjustment');
      setSaving(false);
    }
  }

  const totalIn = lines.reduce(
    (s, l) => s + Math.max(Number(l.adjustment_qty) || 0, 0),
    0,
  );
  const totalOut = lines.reduce(
    (s, l) => s + Math.max(-(Number(l.adjustment_qty) || 0), 0),
    0,
  );

  return (
    <div className="space-y-4 font-mono text-xs">
      <div>
        <button
          onClick={() => router.push('/inventory/stock_adjust')}
          className="inline-flex items-center gap-2 text-slate-500 transition-colors hover:text-slate-700"
        >
          <ArrowLeftIcon size={16} /> Back to Adjustments
        </button>
        <h2 className="mt-3 flex items-center gap-2 text-2xl font-bold text-slate-800 md:text-3xl">
          <ArrowLeftRight className="text-[#1a9e52]" />
          {mode === 'create'
            ? 'New Stock Adjustment'
            : `Edit ${initial?.adjustment_no ?? 'Adjustment'}`}
        </h2>
        <p className="mt-1 text-slate-500">
          Correct inventory through the movement ledger — balances are never
          edited directly.
        </p>
      </div>

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

      {/* ── Header ── */}
      <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-500">
          Adjustment Details
        </h3>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Adjustment Date *</Label>
            <Input
              type="date"
              value={adjustmentDate}
              onChange={(e) => setAdjustmentDate(e.target.value)}
              className="text-xs font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Reference No</Label>
            <Input
              value={referenceNo}
              onChange={(e) => setReferenceNo(e.target.value)}
              placeholder="Count sheet / ticket (optional)"
              className="text-xs font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Reason *</Label>
            <select
              value={reasonCode}
              onChange={(e) => setReasonCode(e.target.value)}
              className="w-full rounded-md border border-slate-200 px-2 py-2 text-xs font-mono outline-none focus:border-emerald-500"
            >
              <option value="">Select reason…</option>
              {reasons.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <AsyncSearchSelect
            label="Warehouse *"
            placeholder="Select warehouse..."
            apiUrl={API.inventory.warehouse.root}
            value={warehouse.id}
            selectedLabel={warehouse.name}
            enablePopupSearch
            onChangeAction={(s) => {
              if (!s?.id) return;
              setWarehouse({ id: Number(s.id), name: s.name });
              setLocation({ id: null, name: '' });
              // Location context changed: stock figures are stale.
              setLines([]);
            }}
          />
          <AsyncSearchSelect
            label="Location *"
            placeholder={
              warehouse.id ? 'Select location...' : 'Pick warehouse first'
            }
            apiUrl={
              warehouse.id
                ? API.inventory.warehouse.locations(warehouse.id)
                : ''
            }
            value={location.id}
            selectedLabel={location.name}
            enablePopupSearch
            onChangeAction={(s) => {
              if (!s?.id) return;
              setLocation({ id: Number(s.id), name: s.name });
              setLines([]);
            }}
          />
          <div className="space-y-1.5">
            <Label className="text-xs">Remarks</Label>
            <Input
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Optional note"
              className="text-xs font-mono"
            />
          </div>
        </div>
      </section>

      {/* ── Items ── */}
      <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Items ({lines.length})
            <span className="ml-3 font-mono normal-case tracking-normal">
              <span className="text-emerald-600">+{totalIn}</span>
              {' · '}
              <span className="text-rose-600">-{totalOut}</span>
            </span>
          </h3>
          <button
            type="button"
            disabled={!headerReady}
            title={headerReady ? '' : 'Pick warehouse & location first'}
            onClick={() => openEditor(-1)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-white hover:bg-emerald-500 disabled:opacity-40"
          >
            <PlusIcon size={13} /> Add Item
          </button>
        </div>

        {lines.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-slate-400">
            {headerReady
              ? 'No items yet — add the first adjustment line.'
              : 'Select a warehouse and location, then add items.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full tabular-nums">
              <thead>
                <tr className="border-b text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="py-2 pr-3 text-left font-bold">Item</th>
                  <th className="py-2 pr-3 text-right font-bold">Current</th>
                  <th className="py-2 pr-3 text-right font-bold">Adjustment</th>
                  <th className="py-2 pr-3 text-right font-bold">New Qty</th>
                  <th className="py-2 pr-3 text-left font-bold">UOM</th>
                  <th className="py-2 pr-3 text-left font-bold">Serials</th>
                  <th className="py-2 font-bold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, idx) => {
                  const qty = Number(l.adjustment_qty) || 0;
                  return (
                    <tr key={idx} className="border-b last:border-b-0">
                      <td className="py-2 pr-3 font-medium">{l.item_label}</td>
                      <td className="py-2 pr-3 text-right text-slate-500">
                        {l.current_qty}
                      </td>
                      <td
                        className={`py-2 pr-3 text-right font-semibold ${qty > 0 ? 'text-emerald-600' : 'text-rose-600'}`}
                      >
                        {qty > 0 ? `+${qty}` : qty}
                      </td>
                      <td className="py-2 pr-3 text-right font-semibold">
                        {l.current_qty + qty}
                      </td>
                      <td className="py-2 pr-3">{l.uom_label || '—'}</td>
                      <td className="py-2 pr-3 text-[10px] text-slate-500">
                        {l.track_serial
                          ? `${l.serial_numbers.length} serial(s)`
                          : '—'}
                      </td>
                      <td className="py-2">
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditor(idx)}
                            className="rounded-lg border border-violet-200 p-1.5 text-violet-600 hover:bg-violet-50"
                          >
                            <PencilIcon size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setLines((p) => p.filter((_, i) => i !== idx))
                            }
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
      </section>

      {/* ── Save ── */}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => router.push('/inventory/stock_adjust')}
          className="rounded-xl border border-slate-200 px-5 py-2.5 text-slate-600 hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-[#1a9e52] px-5 py-2.5 font-semibold text-white hover:bg-[#158042] disabled:opacity-50"
        >
          {saving ? (
            <Loader2Icon className="animate-spin" size={15} />
          ) : (
            <SaveIcon size={15} />
          )}
          {saving ? 'Saving…' : 'Save Draft'}
        </button>
      </div>

      {/* ── Line editor modal ── */}
      {editorIndex !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl space-y-4 overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-sm font-semibold">
              {editorIndex === -1 ? 'Add Item' : 'Edit Item'}
            </h3>
            <span className="ml-2 font-mono text-[10px] font-normal text-slate-400 flex items-center">
              <Warehouse className="size-5 text-emerald-200" />
              &nbsp; {warehouse.name} ·{' '}
              <MapPin className="size-5 text-emerald-200" /> {location.name}
            </span>

            <AsyncSearchSelect
              label="Item *"
              placeholder="Search stock item..."
              apiUrl={API.inventory.stockItem.root}
              value={draft.item_id || null}
              selectedLabel={draft.item_label}
              enablePopupSearch
              onChangeAction={onPickItem}
            />

            {/* Item info (live from the movement-engine balances) */}
            {draft.item_id > 0 && (
              <div className="grid grid-cols-3 gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-[11px]">
                <span className="text-slate-400">Current Stock</span>
                <span className="text-slate-400">Adjustment</span>
                <span className="text-slate-400">New Qty</span>
                <span className="font-semibold">
                  {onHandLoading ? '…' : draft.current_qty}
                </span>
                <span
                  className={`font-semibold ${draftQty > 0 ? 'text-emerald-600' : draftQty < 0 ? 'text-rose-600' : ''}`}
                >
                  {draftQty > 0 ? `+${draftQty}` : draftQty || '—'}
                </span>
                <span
                  className={`font-semibold ${draftNewQty < 0 ? 'text-rose-600' : ''}`}
                >
                  {draftNewQty}
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Adjustment Qty * (+ in / − out)
                </Label>
                <Input
                  type="number"
                  step="1"
                  value={draft.adjustment_qty}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      adjustment_qty: e.target.value,
                      serial_numbers: [],
                    }))
                  }
                  placeholder="e.g. -3 or +5"
                  className="text-xs font-mono"
                />
              </div>
              {draftQty > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Unit Cost</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={draft.unit_cost}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        unit_cost: e.target.value,
                      }))
                    }
                    className="text-xs font-mono"
                  />
                </div>
              )}
            </div>

            {draft.item_id > 0 && (
              <AsyncSearchSelect
                label="UOM"
                placeholder="Select UOM..."
                apiUrl={`${API.inventory.itemUom.root}?item_id=${draft.item_id}`}
                value={draft.item_uom_id}
                selectedLabel={draft.uom_label}
                enablePopupSearch
                onChangeAction={(s) =>
                  setDraft((d) => ({
                    ...d,
                    item_uom_id: s?.id ? Number(s.id) : null,
                    uom_label: s?.name ?? '',
                  }))
                }
              />
            )}

            {/* Serial handling — direction decides the panel */}
            {draft.track_serial && draftQty > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs">
                  New Serial Numbers ({draft.serial_numbers.length}/
                  {Math.abs(draftQty)})
                </Label>
                <SerialEntryPanel
                  value={draft.serial_numbers}
                  onChange={(serials) =>
                    setDraft((d) => ({
                      ...d,
                      serial_numbers: serials,
                    }))
                  }
                  requiredCount={Math.abs(draftQty)}
                  generate={
                    draft.item_id
                      ? {
                          itemId: draft.item_id,
                          warehouseId: warehouse.id ?? undefined,
                          mode: draft.serial_generation,
                        }
                      : undefined
                  }
                />
              </div>
            )}
            {draft.track_serial && draftQty < 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Remove Serial Numbers ({draft.serial_numbers.length}/
                  {Math.abs(draftQty)})
                </Label>
                <SerialLookupPanel
                  itemId={draft.item_id}
                  warehouseId={warehouse.id!}
                  locationId={location.id}
                  requiredCount={Math.abs(draftQty)}
                  value={draft.serial_numbers}
                  onChange={(serials) =>
                    setDraft((d) => ({
                      ...d,
                      serial_numbers: serials,
                    }))
                  }
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">Line Remarks</Label>
              <Input
                value={draft.remarks}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, remarks: e.target.value }))
                }
                placeholder="Optional"
                className="text-xs font-mono"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setEditorIndex(null)}
                className="rounded-lg border px-4 py-2 text-xs hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={commitLine}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-xs text-white hover:bg-emerald-500"
              >
                {editorIndex === -1 ? 'Add' : 'Update'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
