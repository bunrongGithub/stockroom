'use client';

import AsyncSearchSelect from '@/components/ui/AsyncSearchSelect';
import SerialEntryPanel from '@/components/ui/serial/SerialEntryPanel';
import SerialLookupPanel from '@/components/ui/serial/SerialLookupPanel';
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
  ChevronRight,
  Package as PackageIcon,
  ArrowLeftRight,
  Loader2Icon,
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
import { EditableInput, FieldLabel } from '@/components/ui/FieldLabel';
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

const TABS = [
  { id: 'info' as const, label: 'Adjust Info', num: 1 },
  { id: 'items' as const, label: 'Items', num: 2 },
];
type TabId = (typeof TABS)[number]['id'];

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
  const [activeTab, setActiveTab] = useState<TabId>('info');
  /** Validation for the open line, shown inside the dialog rather than the page. */
  const [lineError, setLineError] = useState<string | null>(null);
  // Controlled so a serial-count failure can pull the user to that tab.
  const [editorTab, setEditorTab] = useState('details');

  useEffect(() => {
    stockAdjustmentApi
      .reasons()
      .then(setReasons)
      .catch(() => {});
  }, []);

  // ── Line editor helpers ──────────────────────────────────────────────
  const headerReady = !!warehouse.id && !!location.id;

  function openEditor(index: number) {
    setLineError(null);
    setEditorTab('details');
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
    setLineError(null);
    const fail = (message: string, tab = 'details') => {
      setEditorTab(tab);
      setLineError(message);
    };
    if (!draft.item_id) return fail('Select an item.');
    if (!draftQty) return fail('Adjustment quantity cannot be 0.');
    if (draftQty < 0 && draft.current_qty + draftQty < 0) {
      return fail(
        `Only ${draft.current_qty} on hand — removing ${Math.abs(draftQty)} would make stock negative.`,
      );
    }
    if (
      draft.track_serial &&
      draft.serial_numbers.length !== Math.abs(draftQty)
    ) {
      return fail(
        `Exactly ${Math.abs(draftQty)} serial number(s) required for ${draft.item_label}.`,
        'serials',
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

  /**
   * The quantity half of the line editor — the whole body for a plain item and
   * the first tab for a serial-tracked one, mirroring Delivery Note.
   */
  const detailFields = (
    <>
      <AsyncSearchSelect
        label="Item *"
        placeholder="Search stock item..."
        apiUrl={API.inventory.stockItem.root}
        value={draft.item_id || null}
        selectedLabel={draft.item_label}
        enablePopupSearch
        onChangeAction={onPickItem}
      />

      {/* Live figures from the movement-engine balances */}
      {draft.item_id > 0 && (
        <div className="grid grid-cols-3 gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
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
          <span className={`font-semibold ${draftNewQty < 0 ? 'text-rose-600' : ''}`}>
            {draftNewQty}
          </span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <FieldLabel required>Adjustment Qty (+ in / − out)</FieldLabel>
          <EditableInput
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
          />
        </div>
        {draftQty > 0 && (
          <div>
            <FieldLabel>Unit Cost</FieldLabel>
            <EditableInput
              type="number"
              min={0}
              step="0.01"
              value={draft.unit_cost}
              onChange={(e) =>
                setDraft((d) => ({ ...d, unit_cost: e.target.value }))
              }
            />
          </div>
        )}
        {draft.item_id > 0 && (
          <AsyncSearchSelect
            label="UOM"
            placeholder="Select UOM..."
            apiUrl={`${API.inventory.itemUom.root}?item_id=${draft.item_id}`}
            value={draft.item_uom_id}
            selectedLabel={draft.uom_label}
            enablePopupSearch
            onChangeAction={(sel) =>
              setDraft((d) => ({
                ...d,
                item_uom_id: sel?.id ? Number(sel.id) : null,
                uom_label: sel?.name ?? '',
              }))
            }
          />
        )}
        <div className="sm:col-span-2">
          <FieldLabel>Line Remarks</FieldLabel>
          <EditableInput
            value={draft.remarks}
            onChange={(e) => setDraft((d) => ({ ...d, remarks: e.target.value }))}
            placeholder="Optional"
          />
        </div>
      </div>
    </>
  );

  /**
   * Serial panel. Direction decides which one: adding stock mints new serials,
   * removing stock picks existing ones out of the location.
   */
  const serialFields =
    draftQty > 0 ? (
      <SerialEntryPanel
        value={draft.serial_numbers}
        onChange={(serials) => setDraft((d) => ({ ...d, serial_numbers: serials }))}
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
    ) : (
      <SerialLookupPanel
        itemId={draft.item_id}
        warehouseId={warehouse.id!}
        locationId={location.id}
        requiredCount={Math.abs(draftQty)}
        value={draft.serial_numbers}
        onChange={(serials) => setDraft((d) => ({ ...d, serial_numbers: serials }))}
      />
    );

  return (
    <div className="space-y-4 font-mono text-xs">
      <FormHeader
        onBackAction={() => router.push('/inventory/stock_adjust')}
        backLabel="Back"
        icon={<ArrowLeftRight />}
        title={
          mode === 'create'
            ? 'New Stock Adjustment'
            : `Edit ${initial?.adjustment_no ?? 'Adjustment'}`
        }
        subtitle="Correct inventory through the movement ledger — balances are never edited directly."
        actions={
          <>
            <HeaderAction
              label="Cancel"
              onClick={() => router.push('/inventory/stock_adjust')}
            />
            <HeaderAction
              tone="primary"
              label={saving ? 'Saving…' : 'Save Draft'}
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
          <SidebarCard
            icon={<ArrowLeftRight size={13} />}
            title="Adjustment Summary"
          >
            <div className="space-y-2">
              <SummaryRow label="Date">{adjustmentDate}</SummaryRow>
              <SummaryRow label="Warehouse" title={warehouse.name || undefined}>
                {warehouse.name || '—'}
              </SummaryRow>
              <SummaryRow label="Location" title={location.name || undefined}>
                {location.name || '—'}
              </SummaryRow>
              <SummaryRow label="Lines">{lines.length}</SummaryRow>
              <SummaryRow label="Net" strong>
                <span className="text-emerald-600">+{totalIn}</span>
                {' · '}
                <span className="text-rose-600">−{totalOut}</span>
              </SummaryRow>
            </div>
          </SidebarCard>
        }
      >
        <TabNav tabs={TABS} active={activeTab} onChangeAction={setActiveTab} />

        {/* Tab 1: Adjust Info */}
        {activeTab === 'info' && (
          <TabPanel>
            <SectionCard
              icon={<ArrowLeftRight size={13} />}
              title="Adjustment Details"
            >
              <FieldGrid>
                <div>
                  <FieldLabel required>Adjustment Date</FieldLabel>
                  <EditableInput
                    type="date"
                    value={adjustmentDate}
                    onChange={(e) => setAdjustmentDate(e.target.value)}
                  />
                </div>
                <div>
                  <FieldLabel>Reference No</FieldLabel>
                  <EditableInput
                    value={referenceNo}
                    onChange={(e) => setReferenceNo(e.target.value)}
                    placeholder="Count sheet / ticket (optional)"
                  />
                </div>
                <div>
                  <FieldLabel required>Reason</FieldLabel>
                  <select
                    value={reasonCode}
                    onChange={(e) => setReasonCode(e.target.value)}
                    className="min-h-11.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-2 shadow-sm outline-none focus:border-[#1a9e52]"
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
                <div>
                  <FieldLabel>Remarks</FieldLabel>
                  <EditableInput
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Optional note"
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
              icon={<PackageIcon size={13} />}
              title={`Items (${lines.length})`}
              action={
                <button
                  type="button"
                  disabled={!headerReady}
                  title={headerReady ? '' : 'Pick warehouse & location first'}
                  onClick={() => openEditor(-1)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#1a9e52] px-3 py-2 text-white transition-colors hover:bg-[#158042] disabled:opacity-40"
                >
                  <PlusIcon size={13} /> Add Item
                </button>
              }
            >
              {lines.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-slate-400">
                  {headerReady
                    ? 'No items yet — add the first adjustment line.'
                    : 'Select a warehouse and location, then add items.'}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs font-mono tabular-nums">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="py-2 pr-3 text-left font-medium">Item</th>
                        <th className="py-2 pr-3 text-right font-medium">
                          Current
                        </th>
                        <th className="py-2 pr-3 text-right font-medium">
                          Adjustment
                        </th>
                        <th className="py-2 pr-3 text-right font-medium">
                          New Qty
                        </th>
                        <th className="py-2 pr-3 text-left font-medium">UOM</th>
                        <th className="py-2 pr-3 text-left font-medium">
                          Serials
                        </th>
                        <th className="py-2 text-right font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((l, idx) => {
                        const qty = Number(l.adjustment_qty) || 0;
                        return (
                          <tr
                            key={idx}
                            onClick={() => openEditor(idx)}
                            title="Edit this line"
                            className="cursor-pointer border-b last:border-b-0 hover:bg-muted/30"
                          >
                            <td className="py-2 pr-3 font-medium">
                              {l.item_label}
                            </td>
                            <td className="py-2 pr-3 text-right text-muted-foreground">
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
                            <td className="py-2 pr-3 text-muted-foreground">
                              {l.track_serial
                                ? `${l.serial_numbers.length}/${Math.abs(qty)}`
                                : '—'}
                            </td>
                            <td className="py-2 text-right">
                              <div className="flex justify-end gap-1.5">
                                <button
                                  type="button"
                                  title="Edit line"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openEditor(idx);
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
                                    setLines((p) =>
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
              <StepButton onClick={() => setActiveTab('info')}>
                <ArrowLeftIcon size={16} /> Adjust Info
              </StepButton>
            </div>
          </TabPanel>
        )}
      </FormLayout>

      {/* ── Line editor ── */}
      {editorIndex !== null && (
        <LineItemDialog
          open
          onOpenChange={(o) => !o && setEditorIndex(null)}
          mode={editorIndex === -1 ? 'create' : 'edit'}
          error={lineError}
          onConfirm={commitLine}
          activeTab={editorTab}
          onTabChangeAction={setEditorTab}
          context={
            <>
              <LineDialogFact
                icon={<Warehouse className="text-emerald-600" size={13} />}
              >
                {warehouse.name}
              </LineDialogFact>
              <LineDialogFact
                icon={<MapPin className="text-emerald-600" size={13} />}
              >
                {location.name}
              </LineDialogFact>
            </>
          }
          tabs={
            draft.track_serial && draftQty !== 0
              ? [
                  {
                    id: 'details',
                    label: 'Item Details',
                    content: detailFields,
                  },
                  {
                    id: 'serials',
                    label: draftQty > 0 ? 'New Serials' : 'Remove Serials',
                    badge: (
                      <span
                        className={
                          draft.serial_numbers.length === Math.abs(draftQty)
                            ? 'text-emerald-600'
                            : 'text-amber-600'
                        }
                      >
                        {draft.serial_numbers.length}/{Math.abs(draftQty)}
                      </span>
                    ),
                    content: serialFields,
                  },
                ]
              : undefined
          }
        >
          {detailFields}
        </LineItemDialog>
      )}
    </div>
  );
}
