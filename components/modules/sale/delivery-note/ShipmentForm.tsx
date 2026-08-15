'use client';

import AsyncSearchSelect from '@/components/ui/AsyncSearchSelect';
import SerialLookupPanel from '@/components/ui/serial/SerialLookupPanel';
import {
  EditableInput,
  EditableTextarea,
  FieldLabel,
} from '@/components/ui/FieldLabel';
import { ReadonlyInput } from '@/components/ui/Readonly';
import { LineDialogFact, LineItemDialog } from '@/components/ui/LineItemDialog';
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
import { QuantityInBase } from '@/components/ui/UomConversionPreview';
import { toBaseQty } from '@/service/core/uom-conversion';
import { baseOptionOf, fetchItemUoms } from '@/components/ui/ItemUomSelect';
import { saleShipmentApi } from '@/lib/api/sale';
import { API } from '@/lib/constant';
import { behaviorOf } from '@/service/core/item-behavior';
import type { SalesOrder, SalesShipment } from '@/types/sales/order-management';
import {
  AlertCircle,
  ArrowLeftIcon,
  ChevronRight,
  Loader2Icon,
  Package,
  PencilIcon,
  SaveIcon,
  Truck,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const TABS = [
  { id: 'details' as const, label: 'Details', num: 1 },
  { id: 'items' as const, label: 'Items', num: 2 },
];
type TabId = (typeof TABS)[number]['id'];

type ShipLine = {
  sales_order_item_id: number;
  item_id: number;
  product_name: string;
  /** The item's own reference/part number, shown ahead of the name. */
  product_reference_no: string | null;
  uom: string;
  item_uom_id: number | null;
  track_serial: boolean;
  ordered_qty: number;
  previously_shipped_qty: number;
  remaining: number;
  location_id: number | null;
  location_name: string;
  shipment_qty: number;
  serial_numbers: string[];
  /** base_qty = shipment_qty × base_factor (1 when the line is in base UOM). */
  base_factor?: number;
  /** The item's base unit name, for the "5 Box = 60 Piece" hint. */
  base_uom_name?: string;
};

function buildLines(order: SalesOrder, initial?: SalesShipment): ShipLine[] {
  if (initial) {
    // Edit: start from the shipment's own lines.
    return initial.items.map((s) => {
      const so = order.items.find((o) => o.id === s.sales_order_item_id);
      const previously = so ? so.shipped_qty : s.previously_shipped_qty;
      const ordered = so ? so.ordered_qty : s.ordered_qty;
      return {
        sales_order_item_id: s.sales_order_item_id,
        item_id: s.item_id,
        product_name: s.product_name,
        // Prefer the order line: it is the same item, and on older shipments
        // saved before the field existed the shipment row has nothing.
        product_reference_no:
          so?.product_reference_no ?? s.product_reference_no ?? null,
        uom: s.uom,
        item_uom_id: s.item_uom_id,
        track_serial: s.track_serial ?? so?.track_serial ?? false,
        ordered_qty: ordered,
        previously_shipped_qty: previously,
        // remaining excludes this draft's own qty so it can be re-entered
        remaining: ordered - previously,
        location_id: s.location_id,
        location_name: s.location_name,
        shipment_qty: s.shipment_qty,
        serial_numbers: Array.isArray(
          (s as { serial_numbers?: string[] }).serial_numbers,
        )
          ? ((s as { serial_numbers?: string[] }).serial_numbers ?? [])
          : [],
      };
    });
  }
  // Create: every shippable order line that still has quantity to ship.
  // Non-stock/service lines fulfill by invoicing and never appear here.
  return order.items
    .filter((o) => behaviorOf(o.item_class).requiresShipment)
    .map((o) => {
      const remaining = o.ordered_qty - o.shipped_qty;
      return {
        sales_order_item_id: o.id,
        item_id: o.item_id,
        product_name: o.product_name,
        product_reference_no: o.product_reference_no ?? null,
        uom: o.uom,
        item_uom_id: o.item_uom_id,
        track_serial: o.track_serial ?? false,
        ordered_qty: o.ordered_qty,
        previously_shipped_qty: o.shipped_qty,
        remaining,
        location_id: null,
        location_name: '',
        shipment_qty: remaining,
        serial_numbers: [],
      };
    })
    .filter((l) => l.remaining > 0);
}

export default function ShipmentForm({
  mode,
  order,
  initial,
}: {
  mode: 'create' | 'edit';
  order: SalesOrder;
  initial?: SalesShipment;
}) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);

  const [activeTab, setActiveTab] = useState<TabId>('details');
  const [referenceNo, setReferenceNo] = useState(initial?.reference_no ?? '');
  const [deliveryDate, setDeliveryDate] = useState(
    initial?.delivery_date?.slice(0, 10) ?? today,
  );
  const [receiverName, setReceiverName] = useState(
    initial?.receiver_name ?? '',
  );
  const [deliveryAddress, setDeliveryAddress] = useState(
    initial?.delivery_address ?? '',
  );
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [lines, setLines] = useState<ShipLine[]>(buildLines(order, initial));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Resolve each line's conversion so the form can show the stock effect and,
  // for serial-tracked items, ask for the right number of serials — one serial
  // is one BASE unit, so 10 Box of 12 needs 120, not 10.
  useEffect(() => {
    let active = true;
    const itemIds = [...new Set(lines.map((l) => l.item_id))];
    if (itemIds.length === 0) return;

    Promise.all(
      itemIds.map(async (itemId) => ({
        itemId,
        uoms: await fetchItemUoms(itemId).catch(() => []),
      })),
    ).then((results) => {
      if (!active) return;
      const byItem = new Map(results.map((r) => [r.itemId, r.uoms]));
      setLines((prev) =>
        prev.map((l) => {
          const uoms = byItem.get(l.item_id) ?? [];
          const base = baseOptionOf(uoms);
          const picked = uoms.find((u) => u.id === l.item_uom_id) ?? base;
          return {
            ...l,
            base_factor: picked?.baseFactor ?? 1,
            base_uom_name: base?.name ?? '',
          };
        }),
      );
    });

    return () => {
      active = false;
    };
    // Runs once for the line set the form was built with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Line editor modal ────────────────────────────────────────────────
  // Unlike Sales Order there is no "add": a shipment can only fulfil lines the
  // order already has, so the editor always opens on an existing line.
  const [editorIndex, setEditorIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState<ShipLine | null>(null);
  const [lineError, setLineError] = useState<string | null>(null);
  // Controlled so a serial-count failure can pull the user to that tab instead
  // of reporting an error about fields they cannot see.
  const [editorTab, setEditorTab] = useState('details');

  function openEditor(index: number) {
    setLineError(null);
    setEditorTab('details');
    setDraft({ ...lines[index] });
    setEditorIndex(index);
  }

  function patchDraft(patch: Partial<ShipLine>) {
    setDraft((d) => (d ? { ...d, ...patch } : d));
  }

  function commitLine() {
    if (!draft || editorIndex === null) return;
    setLineError(null);

    const qty = Number(draft.shipment_qty) || 0;
    const fail = (message: string, tab = 'details') => {
      setEditorTab(tab);
      setLineError(message);
    };

    if (qty < 0) return fail('Shipment quantity cannot be negative.');
    if (qty > draft.remaining)
      return fail(
        `Only ${draft.remaining} ${draft.uom || 'unit(s)'} remain to ship on this line.`,
      );
    if (qty > 0 && !draft.location_id)
      return fail('Select the location this line ships from.');

    if (draft.track_serial && draft.serial_numbers.length !== requiredSerials)
      return fail(
        `Exactly ${requiredSerials} serial number(s) required for ${draft.product_name}.`,
        'serials',
      );

    setLines((prev) => prev.map((l, i) => (i === editorIndex ? draft : l)));
    setEditorIndex(null);
  }

  async function handleSubmit() {
    setError('');
    const active = lines.filter((l) => l.shipment_qty > 0);
    if (active.length === 0) {
      setActiveTab('items');
      return setError('Enter a shipment quantity for at least one item');
    }
    for (const l of active) {
      if (!l.location_id) {
        setActiveTab('items');
        return setError(`Select a stock location for ${l.product_name}`);
      }
      if (l.shipment_qty > l.remaining) {
        setActiveTab('items');
        return setError(
          `Quantity for ${l.product_name} exceeds remaining (${l.remaining})`,
        );
      }
      // One serial identifies one BASE unit, so the count is checked against
      // the converted quantity — shipping 1 Piecs of 2 Unit needs 2 serials,
      // which is also what SerialLookupPanel asks for.
      const requiredSerials = toBaseQty(Number(l.shipment_qty), {
        itemUomId: l.item_uom_id,
        uomId: null,
        baseFactor: l.base_factor ?? 1,
      });
      if (l.track_serial && l.serial_numbers.length !== requiredSerials) {
        setActiveTab('items');
        const inBase =
          (l.base_factor ?? 1) !== 1
            ? ` (${l.shipment_qty} ${l.uom} = ${requiredSerials} ${l.base_uom_name})`
            : '';
        return setError(
          `Select exactly ${requiredSerials} serial number(s) for ${l.product_name}${inBase}`,
        );
      }
    }

    if (!order.warehouse_id) {
      return setError(
        'This order has no warehouse — only orders with stock items can be shipped',
      );
    }

    setSaving(true);
    try {
      const payload = {
        sales_order_id: order.id,
        customer_name: order.customer_name,
        customer_phone: order.customer_phone || undefined,
        delivery_date: deliveryDate,
        warehouse_id: order.warehouse_id,
        reference_no: referenceNo.trim() || undefined,
        receiver_name: receiverName || undefined,
        delivery_address: deliveryAddress || undefined,
        notes: notes || undefined,
        items: active.map((l) => ({
          sales_order_item_id: l.sales_order_item_id,
          item_id: l.item_id,
          location_id: l.location_id as number,
          item_uom_id: l.item_uom_id ?? undefined,
          ordered_qty: l.ordered_qty,
          previously_shipped_qty: l.previously_shipped_qty,
          shipment_qty: Number(l.shipment_qty),
          serial_numbers: l.serial_numbers,
        })),
      };
      const saved =
        mode === 'create'
          ? await saleShipmentApi.create(payload)
          : await saleShipmentApi.update(initial!.id, payload);
      router.push(`/sale/delivery-note/${saved.id}/view`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save shipment');
      setSaving(false);
    }
  }

  const totalUnits = lines.reduce(
    (s, l) => s + (Number(l.shipment_qty) || 0),
    0,
  );

  // One serial identifies one BASE unit, so 2 Box of 12 needs 24 — not 2.
  const requiredSerials = draft
    ? Math.round((Number(draft.shipment_qty) || 0) * (draft.base_factor ?? 1))
    : 0;

  /**
   * The quantity half of the line editor. Held here because it is the whole
   * body for a plain line and the first tab for a serial-tracked one.
   */
  const detailFields = draft && (
    <section className='grid gap-4'>
      <div className="grid gap-4 sm:grid-cols-1">
        <AsyncSearchSelect
          label="Location *"
          placeholder="Select location..."
          apiUrl={API.inventory.warehouse.locations(order.warehouse_id ?? 0)}
          value={draft.location_id}
          selectedLabel={draft.location_name}
          enablePopupSearch
          onChangeAction={(sel) =>
            patchDraft({
              location_id: sel?.id ? Number(sel.id) : null,
              location_name: sel?.name ?? '',
            })
          }
        />
      </div>
      <div className='grid gap-4 sm:grid-cols-2'>
        <div>
          {/* A shipment fulfils an order line, so it is always denominated in
            that line's unit — the remaining quantity is expressed in it. */}
          <FieldLabel>UOM</FieldLabel>
          <ReadonlyInput value={draft.uom ?? ''} />
        </div>
        <div>
          <FieldLabel required>Delivery Qty</FieldLabel>
          <EditableInput
            type="number"
            min={0}
            max={draft.remaining}
            step="0.001"
            value={draft.shipment_qty}
            onChange={(e) =>
              patchDraft({ shipment_qty: Number(e.target.value) })
            }
          />
        </div>
      </div>
    </section>
  );

  return (
    <div className="space-y-4 font-mono text-xs">
      <FormHeader
        backHref="/sale/delivery-note"
        backLabel="Back"
        icon={<Truck />}
        title={
          mode === 'create'
            ? 'Delivery'
            : `Edit ${initial?.shipment_no ?? 'Delivery'}`
        }
        subtitle={`For order ${order.order_no} • ${order.customer_name}`}
        actions={
          <>
            <HeaderAction label="Discard" href="/sale/delivery-note" />
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
              disabled={saving || lines.length === 0}
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
            <SidebarCard icon={<Truck size={13} />} title="Delivery Summary">
              <div className="space-y-2">
                <SummaryRow label="Order">{order.order_no}</SummaryRow>
                <SummaryRow
                  label="Warehouse"
                  title={order.warehouse_name ?? undefined}
                >
                  {order.warehouse_name}
                </SummaryRow>
                <SummaryRow label="Lines">{lines.length}</SummaryRow>
                <SummaryRow label="Total Units" strong>
                  {totalUnits}
                </SummaryRow>
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
              icon={<Truck size={13} />}
              title="Delivery Information"
            >
              <FieldGrid>
                <div>
                  <FieldLabel>Customer</FieldLabel>
                  <ReadonlyInput value={order.customer_name ?? ''} />
                </div>
                <div>
                  <FieldLabel>Customer Phone</FieldLabel>
                  <ReadonlyInput value={order.customer_phone ?? ''} />
                </div>
                <div>
                  <FieldLabel>Reference No</FieldLabel>
                  <EditableInput
                    value={referenceNo}
                    onChange={(e) => setReferenceNo(e.target.value)}
                    placeholder="Tracking / customer PO (optional)"
                  />
                </div>
                <div>
                  <FieldLabel required>Delivery Date</FieldLabel>
                  <EditableInput
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                  />
                </div>
                <div>
                  <FieldLabel>Warehouse</FieldLabel>
                  <ReadonlyInput value={order.warehouse_name ?? ''} />
                </div>
                <div>
                  <FieldLabel>Receiver Name</FieldLabel>
                  <EditableInput
                    value={receiverName ?? ''}
                    onChange={(e) => setReceiverName(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <FieldLabel>Delivery Address</FieldLabel>
                  <EditableInput
                    value={deliveryAddress ?? ''}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder="Optional"
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
                Delivery Items <ChevronRight size={16} />
              </StepButton>
            </div>
          </TabPanel>
        )}

        {/* Tab 2: Shipment Items */}
        {activeTab === 'items' && (
          <TabPanel>
            <SectionCard icon={<Package size={13} />} title="Delivery Items">
              {lines.length === 0 ? (
                <p className="py-6 text-center text-slate-400">
                  Nothing left to ship on this order.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs font-mono">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="py-2 pr-3 text-left font-medium">
                          Product
                        </th>
                        <th className="py-2 pr-3 text-right font-medium">
                          Ordered
                        </th>
                        <th className="py-2 pr-3 text-right font-medium">
                          Delivered
                        </th>
                        <th className="py-2 pr-3 text-right font-medium">
                          Remaining
                        </th>
                        <th className="py-2 pr-3 text-left font-medium">
                          Location
                        </th>
                        <th className="py-2 pr-3 text-left font-medium">UOM</th>
                        <th className="py-2 pr-3 text-right font-medium">
                          Delivery Qty
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((line, idx) => {
                        const required = Math.round(
                          (Number(line.shipment_qty) || 0) *
                            (line.base_factor ?? 1),
                        );
                        return (
                          <tr
                            key={line.sales_order_item_id}
                            onClick={() => openEditor(idx)}
                            title="Edit this line"
                            className="cursor-pointer border-b last:border-b-0 hover:bg-muted/30"
                          >
                            <td className="py-2 pr-3 font-medium">
                              {line.product_name}
                            </td>
                            <td className="py-2 pr-3 text-right">
                              {line.ordered_qty}
                            </td>
                            <td className="py-2 pr-3 text-right text-muted-foreground">
                              {line.previously_shipped_qty}
                            </td>
                            <td className="py-2 pr-3 text-right font-medium text-amber-600">
                              {line.remaining}
                            </td>
                            <td className="py-2 pr-3">
                              {line.location_name || (
                                <span className="text-rose-500">Not set</span>
                              )}
                            </td>
                            <td className="py-2 pr-3">{line.uom || '—'}</td>
                            <td className="py-2 pr-3 text-right font-semibold">
                              {line.shipment_qty}
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
      {draft && (
        <LineItemDialog
          open={editorIndex !== null}
          onOpenChange={(o) => !o && setEditorIndex(null)}
          mode="edit"
          // Items without a reference number drop the separator rather than
          // showing a leading "~".
          title={
            draft.product_reference_no
              ? `${draft.product_reference_no}~${draft.product_name}`
              : draft.product_name
          }
          error={lineError}
          onConfirm={commitLine}
          // Quantities and the serial roster are two jobs; a serial-tracked
          // line splits them so neither pushes the other out of view. A plain
          // line has nothing to split, so it stays single-panel.
          activeTab={editorTab}
          onTabChangeAction={setEditorTab}
          tabs={
            draft.track_serial
              ? [
                  {
                    id: 'details',
                    label: 'Item Details',
                    content: detailFields,
                  },
                  {
                    id: 'serials',
                    label: 'Serials',
                    badge: (
                      <span
                        className={
                          draft.serial_numbers.length === requiredSerials
                            ? 'text-emerald-600'
                            : 'text-amber-600'
                        }
                      >
                        {draft.serial_numbers.length}/{requiredSerials}
                      </span>
                    ),
                    content: (
                      <SerialLookupPanel
                        itemId={draft.item_id}
                        warehouseId={order.warehouse_id ?? 0}
                        locationId={draft.location_id}
                        requiredCount={requiredSerials}
                        value={draft.serial_numbers}
                        onChange={(serials) =>
                          patchDraft({ serial_numbers: serials })
                        }
                      />
                    ),
                  },
                ]
              : undefined
          }
          context={
            <>
              <LineDialogFact
                icon={<Package className="text-emerald-600" size={13} />}
              >
                Ordered {draft.ordered_qty} · Delivered{' '}
                {draft.previously_shipped_qty} · Remaining {draft.remaining}
              </LineDialogFact>
              {order.warehouse_name && (
                <LineDialogFact
                  icon={<Truck className="text-emerald-600" size={13} />}
                >
                  {order.warehouse_name}
                </LineDialogFact>
              )}
            </>
          }
        >
          {detailFields}
        </LineItemDialog>
      )}
    </div>
  );
}
