'use client';

import AsyncSearchSelect from '@/components/ui/AsyncSearchSelect';
import SerialLookupPanel from '@/components/ui/serial/SerialLookupPanel';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { saleShipmentApi } from '@/lib/api/sale';
import { API } from '@/lib/constant';
import type { SalesOrder, SalesShipment } from '@/types/sales/order-management';
import {
  AlertCircle,
  ArrowLeftIcon,
  ChevronRight,
  Loader2Icon,
  Package,
  SaveIcon,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const TABS = [
  { id: 'details' as const, label: 'Details', num: 1 },
  { id: 'items' as const, label: 'Shipment Items', num: 2 },
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
  // Create: every order line that still has quantity to ship.
  return order.items
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
      if (l.track_serial && l.serial_numbers.length !== Number(l.shipment_qty)) {
        setActiveTab('items');
        return setError(
          `Select exactly ${l.shipment_qty} serial number(s) for ${l.product_name}`,
        );
      }
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
      <div>
        <button
          onClick={() => router.push('/sale/delivery-note')}
          className="inline-flex items-center gap-2 text-slate-500 transition-colors hover:text-slate-700"
        >
          <ArrowLeftIcon size={16} /> Back to Shipments
        </button>
        <h2 className="mt-3 flex items-center gap-2 text-2xl font-bold text-slate-800 md:text-3xl">
          <Package className="text-[#1a9e52]" />
          {mode === 'create'
            ? 'New Shipment'
            : `Edit ${initial?.shipment_no ?? 'Shipment'}`}
        </h2>
        <p className="mt-1 text-slate-500">
          For order {order.order_no} • {order.customer_name}
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

      <div className="grid gap-6 xl:grid-cols-[350px_minmax(0,1fr)]">
        {/* LEFT SIDEBAR — summary + actions */}
        <aside className="space-y-4 self-start xl:sticky xl:top-6">
          <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            <div className="border-b border-slate-50 bg-slate-50/80 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Shipment Summary
            </div>
            <div className="space-y-2 p-4">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Order</span>
                <span className="font-semibold text-slate-700">
                  {order.order_no}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Warehouse</span>
                <span className="font-semibold text-slate-700">
                  {order.warehouse_name}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Lines</span>
                <span className="font-semibold text-slate-700">
                  {lines.length}
                </span>
              </div>
              <div className="flex items-center justify-between border-t pt-2 text-sm font-semibold">
                <span>Total Units</span>
                <span>{totalUnits}</span>
              </div>
            </div>
          </section>

          <div className="flex flex-col-reverse gap-2">
            <button
              type="button"
              onClick={() => router.push('/sale/delivery-note')}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-center text-slate-600 transition-colors hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving || lines.length === 0}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1a9e52] px-4 py-2.5 font-semibold text-white transition-colors hover:bg-[#158042] disabled:opacity-50"
            >
              {saving ? (
                <Loader2Icon className="animate-spin" size={16} />
              ) : (
                <SaveIcon size={16} />
              )}
              {saving ? 'Saving...' : 'Save Shipment'}
            </button>
          </div>
        </aside>

        {/* RIGHT — tabs */}
        <div className="min-w-0">
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
                <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                  Shipment Information
                </h3>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Customer</Label>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-mono text-slate-600">
                      {order.customer_name || '—'}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Customer Phone</Label>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-mono text-slate-600">
                      {order.customer_phone || '—'}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Reference No</Label>
                    <Input
                      value={referenceNo}
                      onChange={(e) => setReferenceNo(e.target.value)}
                      placeholder="Tracking / customer PO (optional)"
                      className="text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Delivery Date *</Label>
                    <Input
                      type="date"
                      value={deliveryDate}
                      onChange={(e) => setDeliveryDate(e.target.value)}
                      className="text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Warehouse</Label>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-mono text-slate-600">
                      {order.warehouse_name}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Receiver Name</Label>
                    <Input
                      value={receiverName ?? ''}
                      onChange={(e) => setReceiverName(e.target.value)}
                      placeholder="Optional"
                      className="text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Delivery Address</Label>
                    <Input
                      value={deliveryAddress ?? ''}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      placeholder="Optional"
                      className="text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1.5 lg:col-span-2">
                    <Label className="text-xs">Notes</Label>
                    <textarea
                      value={notes ?? ''}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                      placeholder="Optional notes..."
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>
              </section>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setActiveTab('items')}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-2.5 text-slate-600 transition-colors hover:bg-slate-50"
                >
                  Shipment Items <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Tab 2: Shipment Items */}
          {activeTab === 'items' && (
            <div className="space-y-5 pt-5">
              <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                  Shipment Items
                </h3>
                <div className="space-y-4">
                  {lines.length === 0 ? (
                    <p className="py-6 text-center text-xs text-muted-foreground">
                      Nothing left to ship on this order.
                    </p>
                  ) : (
                    lines.map((line, idx) => (
                      <div
                        key={line.sales_order_item_id}
                        className="rounded-xl border border-slate-200 p-3 space-y-3"
                      >
                        <div className="flex items-center justify-between text-xs font-mono">
                          <span className="font-semibold">
                            {line.product_name}
                          </span>
                          <span className="text-muted-foreground">
                            Ordered {line.ordered_qty} • Shipped{' '}
                            {line.previously_shipped_qty} • Remaining{' '}
                            <span className="text-amber-600 font-medium">
                              {line.remaining}
                            </span>
                          </span>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-3">
                          <AsyncSearchSelect
                            label="Location *"
                            placeholder="Select location..."
                            apiUrl={API.inventory.warehouse.locations(
                              order.warehouse_id,
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
                          <div className="space-y-1.5">
                            <Label className="text-xs">UOM</Label>
                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-mono text-slate-600">
                              {line.uom || '—'}
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Shipment Qty *</Label>
                            <Input
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
                              className="text-xs font-mono"
                            />
                          </div>
                        </div>
                        {line.track_serial && (
                          <SerialLookupPanel
                            itemId={line.item_id}
                            warehouseId={order.warehouse_id}
                            locationId={line.location_id}
                            requiredCount={Number(line.shipment_qty) || 0}
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
              </section>

              <div className="flex justify-start">
                <button
                  type="button"
                  onClick={() => setActiveTab('details')}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-2.5 text-slate-600 transition-colors hover:bg-slate-50"
                >
                  <ArrowLeftIcon size={16} /> Details
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
