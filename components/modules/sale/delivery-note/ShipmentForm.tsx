'use client';

import AsyncSearchSelect from '@/components/ui/AsyncSearchSelect';
import SerialLookupPanel from '@/components/ui/serial/SerialLookupPanel';
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
import { QuantityInBase } from '@/components/ui/UomConversionPreview';
import { toBaseQty } from '@/service/core/uom-conversion';
import {
  baseOptionOf,
  fetchItemUoms,
} from '@/components/ui/ItemUomSelect';
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

  function setLine(idx: number, patch: Partial<ShipLine>) {
    setLines((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)),
    );
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

  return (
    <div className="space-y-4 font-mono text-xs">
      <FormHeader
        backHref="/sale/delivery-note"
        backLabel="Back"
        icon={<Truck />}
        title={
          mode === 'create'
            ? 'Delivery'
            : `Edit ${initial?.shipment_no ?? 'Shipment'}`
        }
        subtitle={`For order ${order.order_no} • ${order.customer_name}`}
        actions={
          <>
            <HeaderAction label="Discard" href="/sale/delivery-note" />
            <HeaderAction
              tone="primary"
              label={saving ? 'Saving…' : 'Save'}
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
            <SectionCard icon={<Package size={13} />} title="Shipment Items">
              <div className="space-y-4">
                {lines.length === 0 ? (
                  <p className="py-6 text-center text-slate-400">
                    Nothing left to ship on this order.
                  </p>
                ) : (
                  lines.map((line, idx) => (
                    <div
                      key={line.sales_order_item_id}
                      className="space-y-3 rounded-xl border border-slate-200 p-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-700">
                          {line.product_name}
                        </span>
                        <span className="text-slate-400">
                          Ordered {line.ordered_qty} • Shipped{' '}
                          {line.previously_shipped_qty} • Remaining{' '}
                          <span className="font-medium text-amber-600">
                            {line.remaining}
                          </span>
                        </span>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-3">
                        <AsyncSearchSelect
                          label="Location"
                          required
                          placeholder="Select location..."
                          apiUrl={API.inventory.warehouse.locations(
                            order.warehouse_id ?? 0,
                          )}
                          value={line.location_id}
                          selectedLabel={line.location_name}
                          enablePopupSearch
                          onChangeAction={(sel) =>
                            setLine(idx, {
                              location_id: sel?.id ? Number(sel.id) : null,
                              location_name: sel?.name ?? '',
                            })
                          }
                        />
                        <div>
                          {/* A shipment fulfils an order line, so it is always
                              denominated in that line's unit — the remaining
                              quantity is expressed in it. */}
                          <FieldLabel>UOM</FieldLabel>
                          <ReadonlyInput value={line.uom ?? ''} />
                        </div>
                        <div>
                          <FieldLabel required>Shipment Qty</FieldLabel>
                          <EditableInput
                            type="number"
                            min={0}
                            max={line.remaining}
                            step="0.001"
                            value={line.shipment_qty}
                            onChange={(e) =>
                              setLine(idx, {
                                shipment_qty: Number(e.target.value),
                              })
                            }
                          />
                          <QuantityInBase
                            quantity={line.shipment_qty}
                            conversion={line.base_factor ?? 1}
                            uomName={line.uom}
                            baseUomName={line.base_uom_name ?? ''}
                          />
                        </div>
                      </div>
                      {line.track_serial && (
                        <SerialLookupPanel
                          itemId={line.item_id}
                          warehouseId={order.warehouse_id ?? 0}
                          locationId={line.location_id}
                          requiredCount={
                            (Number(line.shipment_qty) || 0) *
                            (line.base_factor ?? 1)
                          }
                          value={line.serial_numbers}
                          onChange={(serials) =>
                            setLine(idx, { serial_numbers: serials })
                          }
                        />
                      )}
                    </div>
                  ))
                )}
              </div>
            </SectionCard>

            <div className="flex justify-start">
              <StepButton onClick={() => setActiveTab('details')}>
                <ArrowLeftIcon size={16} /> Details
              </StepButton>
            </div>
          </TabPanel>
        )}
      </FormLayout>
    </div>
  );
}
