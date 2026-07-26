'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import BusinessPartnerLookup from '@/components/master-data/BusinessPartnerLookup';
import ItemClassBadge from '@/components/ui/ItemClassBadge';
import SerialLookupPanel from '@/components/ui/serial/SerialLookupPanel';
import { useItemAutoFill } from '@/hook/useItemAutoFill';
import { behaviorOf } from '@/service/core/item-behavior';
import { useRegisterModule } from '@/hook/useModule';
import { cashSaleApi, type SalesSettings } from '@/lib/api/cash-sale';
import { API } from '@/lib/constant';
import type { ModuleProps } from '@/lib/registry';
import type { BusinessPartnerOption } from '@/types/master-data/business-partner';
import ItemScanSearch from './ItemScanSearch';
import {
    Banknote,
    CreditCard,
    Landmark,
    Loader2,
    QrCode,
    ScanLine,
    Trash2,
    UserRound,
    Warehouse,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

/**
 * Cash Sale — the counter register.
 *
 * One screen: pick the customer, scan/search items, take payment, print. It
 * creates no documents of its own; POST /api/sale/cash-sale runs the whole
 * Sales Order → Shipment → Invoice → Payment chain server-side and hands back
 * the invoice to print.
 */

type CartLine = {
    key: string;
    item_id: number;
    /** stock | non_stock | service — drives per-line behavior and the badge. */
    item_class: string;
    name: string;
    description: string | null;
    quantity: number;
    unit_price: number;
    item_uom_id: number | null;
    uom_name: string;
    track_serial: boolean;
    serial_numbers: string[];
};

type PaymentMethod = 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'CHEQUE' | 'KHQR';

type Option = { id: number; name: string };

const METHODS: { value: PaymentMethod; label: string; icon: typeof Banknote }[] =
    [
        { value: 'CASH', label: 'Cash', icon: Banknote },
        { value: 'CARD', label: 'Card', icon: CreditCard },
        { value: 'KHQR', label: 'ABA KHQR', icon: QrCode },
        { value: 'BANK_TRANSFER', label: 'Transfer', icon: Landmark },
    ];

const money = (n: number) =>
    n.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

export default function CashSaleModule({
    currentPath,
    permission,
    currentPathActions,
}: ModuleProps) {
    useRegisterModule({
        actionModules: currentPathActions,
        permission,
        modulePath: currentPath.path,
    });

    const { resolveItemDefaults } = useItemAutoFill();

    const [settings, setSettings] = useState<SalesSettings | null>(null);
    const [lines, setLines] = useState<CartLine[]>([]);
    // The selected Business Partner, or null for an anonymous walk-in.
    const [customer, setCustomer] = useState<BusinessPartnerOption | null>(null);

    // Where this sale takes stock from. Seeded from Sales Settings; the cashier
    // can switch counter for one sale without changing the company default.
    const [warehouseId, setWarehouseId] = useState<number | null>(null);
    const [locationId, setLocationId] = useState<number | null>(null);
    const [warehouses, setWarehouses] = useState<Option[]>([]);
    const [locations, setLocations] = useState<Option[]>([]);
    const [switchOpen, setSwitchOpen] = useState(false);

    const [method, setMethod] = useState<PaymentMethod>('CASH');
    const [tendered, setTendered] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [toast, setToast] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            try {
                const [s, whRes] = await Promise.all([
                    cashSaleApi.settings(),
                    fetch(`${API.inventory.warehouse.root}?limit=100`).then(
                        (r) => r.json(),
                    ),
                ]);
                setSettings(s);
                setWarehouseId(s.default_sales_warehouse_id);
                setLocationId(s.default_sales_location_id);
                setWarehouses(whRes.data ?? []);
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Failed to load');
            }
        })();
    }, []);

    // Locations belong to a warehouse, so they reload whenever it changes.
    useEffect(() => {
        if (!warehouseId) return;
        fetch(API.inventory.warehouse.locations(warehouseId))
            .then((r) => r.json())
            .then((json) => setLocations(json.data ?? []))
            .catch(() => setLocations([]));
    }, [warehouseId]);

    const grandTotal = useMemo(
        () => lines.reduce((s, l) => s + l.quantity * l.unit_price, 0),
        [lines],
    );
    const change = Math.max(0, (Number(tendered) || 0) - grandTotal);

    const warehouseReady = warehouseId != null && locationId != null;

    const warehouseName =
        warehouses.find((w) => w.id === warehouseId)?.name ??
        settings?.default_sales_warehouse_name ??
        '—';
    const locationName =
        locations.find((l) => l.id === locationId)?.name ??
        settings?.default_sales_location_name ??
        '—';

    // Stock and serials are per warehouse+location: a switch invalidates every
    // serial already picked, so they are dropped rather than silently carried.
    const changeWarehouse = (id: number) => {
        setWarehouseId(id);
        setLocations([]);
        setLocationId(null);
        setLines((prev) => prev.map((l) => ({ ...l, serial_numbers: [] })));
    };

    const changeLocation = (id: number) => {
        setLocationId(id);
        setLines((prev) => prev.map((l) => ({ ...l, serial_numbers: [] })));
    };

    // ── Cart ────────────────────────────────────────────────────────────────

    const addItem = useCallback(
        async (id: number) => {
            const d = await resolveItemDefaults(id);
            setLines((prev) => {
                // Scanning the same non-serial item again just bumps its qty.
                const existing = prev.find(
                    (l) => l.item_id === id && !l.track_serial,
                );
                if (existing) {
                    return prev.map((l) =>
                        l === existing
                            ? { ...l, quantity: l.quantity + 1 }
                            : l,
                    );
                }
                return [
                    ...prev,
                    {
                        key: `${id}-${Date.now()}`,
                        item_id: id,
                        item_class: d.itemClass,
                        name: d.name,
                        description: d.description,
                        quantity: 1,
                        unit_price: d.price ?? 0,
                        item_uom_id: d.itemUomId,
                        uom_name: d.uomName,
                        track_serial: d.trackSerial,
                        serial_numbers: [],
                    },
                ];
            });
        },
        [resolveItemDefaults],
    );

    const patchLine = (key: string, patch: Partial<CartLine>) =>
        setLines((prev) =>
            prev.map((l) => (l.key === key ? { ...l, ...patch } : l)),
        );

    const removeLine = (key: string) =>
        setLines((prev) => prev.filter((l) => l.key !== key));

    /** Ready for the next customer. The counter (warehouse/location) stays put. */
    const reset = () => {
        setLines([]);
        setCustomer(null);
        setTendered('');
        setMethod('CASH');
        setError(null);
    };

    // ── Complete ────────────────────────────────────────────────────────────

    const complete = async () => {
        if (!lines.length || saving) return;
        setSaving(true);
        setError(null);
        try {
            const result = await cashSaleApi.complete({
                // Survives a double-click or a retry: the same key returns the
                // original sale instead of selling the stock twice.
                idempotency_key:
                    globalThis.crypto?.randomUUID?.() ??
                    `cash-${Date.now()}-${Math.random()}`,
                customer: customer
                    ? { customer_id: customer.id, name: customer.name }
                    : { name: 'Walk-in Customer' },
                // The counter the cashier is standing at, which may differ from
                // the company default for this one sale.
                warehouse_id: warehouseId ?? undefined,
                location_id: locationId ?? undefined,
                items: lines.map((l) => ({
                    item_id: l.item_id,
                    item_uom_id: l.item_uom_id,
                    description: l.description,
                    quantity: l.quantity,
                    unit_price: l.unit_price,
                    serial_numbers: l.serial_numbers,
                })),
                payment_method: method,
            });

            // Auto-open the invoice for printing, then clear the counter.
            window.open(
                `/finances/invoice/${result.invoice.id}/print?autoprint=1`,
                '_blank',
            );
            setToast(`${result.invoice.invoice_no} — paid`);
            setTimeout(() => setToast(null), 4000);
            reset();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Sale failed');
        } finally {
            setSaving(false);
        }
    };

    // Every serial-tracked line must have exactly as many serials as its qty.
    const serialsComplete = lines.every(
        (l) => !l.track_serial || l.serial_numbers.length === l.quantity,
    );
    // Warehouse/location only gate the sale when something in the cart
    // actually moves stock (item-behavior); a service-only cart needs neither.
    const cartNeedsInventory = lines.some(
        (l) => behaviorOf(l.item_class).requiresInventory,
    );
    const canComplete =
        permission.can_create &&
        (!cartNeedsInventory || warehouseReady) &&
        lines.length > 0 &&
        serialsComplete &&
        !saving;

    return (
        <div className="animate-in fade-in duration-300 font-mono text-xs">
            {toast && (
                <div className="fixed top-4 right-4 z-50 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-medium text-white shadow-lg">
                    {toast}
                </div>
            )}

            {!warehouseReady && settings && cartNeedsInventory && (
                <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
                    No default sales warehouse or location is configured. Set one
                    in <b>Sale → Settings</b> before selling stock items.
                </div>
            )}

            {/* The counter splits into cart + checkout as soon as there is room
                (≥1024px). Below that it is one column and the pay bar at the
                bottom of the screen keeps checkout one tap away. */}
            <div className="grid gap-4 pb-24 lg:grid-cols-[minmax(0,1fr)_340px] lg:pb-0 xl:grid-cols-[minmax(0,1fr)_380px]">
                {/* ── Cart ─────────────────────────────────────────────── */}
                <div className="space-y-4">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="mb-2 flex items-center gap-2 text-slate-500">
                            <ScanLine size={16} className="text-[#1a9e52]" />
                            <span>Scan or search an item to add it</span>
                        </div>
                        <ItemScanSearch onSelect={(id) => void addItem(id)} />
                    </div>

                    {lines.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-200 p-12 text-center text-slate-400">
                            The cart is empty. Scan an item to begin.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {lines.map((line) => (
                                <div
                                    key={line.key}
                                    className="rounded-2xl border border-slate-200 bg-white p-4"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-slate-800">
                                                {line.name}
                                                <ItemClassBadge
                                                    itemClass={line.item_class}
                                                    iconOnly
                                                />
                                            </p>
                                            <p className="text-slate-400">
                                                {line.uom_name || '—'}
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => removeLine(line.key)}
                                            className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                                            aria-label={`Remove ${line.name}`}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>

                                    <div className="mt-3 grid grid-cols-2 items-end gap-3 sm:grid-cols-[7rem_9rem_1fr]">
                                        <div className="space-y-1">
                                            <Label>Qty</Label>
                                            <Input
                                                type="number"
                                                min={1}
                                                step="any"
                                                inputMode="decimal"
                                                value={line.quantity}
                                                onChange={(e) =>
                                                    patchLine(line.key, {
                                                        quantity:
                                                            Number(
                                                                e.target.value,
                                                            ) || 0,
                                                    })
                                                }
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label>Unit price</Label>
                                            <Input
                                                type="number"
                                                min={0}
                                                step="any"
                                                inputMode="decimal"
                                                value={line.unit_price}
                                                onChange={(e) =>
                                                    patchLine(line.key, {
                                                        unit_price:
                                                            Number(
                                                                e.target.value,
                                                            ) || 0,
                                                    })
                                                }
                                            />
                                        </div>
                                        <div className="col-span-2 flex items-end justify-end pb-1 sm:col-span-1">
                                            <span className="text-base font-semibold text-slate-800">
                                                {money(
                                                    line.quantity *
                                                        line.unit_price,
                                                )}
                                            </span>
                                        </div>
                                    </div>

                                    {line.track_serial && warehouseReady && (
                                        <div className="mt-3 border-t border-slate-100 pt-3">
                                            <SerialLookupPanel
                                                itemId={line.item_id}
                                                warehouseId={warehouseId!}
                                                locationId={locationId}
                                                requiredCount={line.quantity}
                                                value={line.serial_numbers}
                                                onChange={(serials) =>
                                                    patchLine(line.key, {
                                                        serial_numbers: serials,
                                                    })
                                                }
                                            />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* ── Checkout ─────────────────────────────────────────── */}
                <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
                    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="flex items-center gap-2 text-slate-500">
                            <UserRound size={16} className="text-[#1a9e52]" />
                            <span>Customer</span>
                        </div>

                        {/* The partner picker: one box that matches a
                            code, a name or a phone, with inline registration
                            when the person is new. The cashier never leaves
                            this screen, and an anonymous walk-in can still be
                            served by simply leaving it empty. */}
                        <BusinessPartnerLookup
                            label=""
                            role="customer"
                            placeholder="Walk-in — search name, phone or code…"
                            value={customer}
                            onChange={setCustomer}
                        />

                        {/* The counter this sale sells from. Seeded from Sales
                            Settings; switchable for one sale without touching
                            the company default. Hidden while nothing in the
                            cart moves stock — services need no counter. */}
                        {!cartNeedsInventory && lines.length > 0 ? (
                            <div className="rounded-xl bg-slate-50 px-3 py-2 text-slate-400">
                                No stock items — warehouse not needed for this
                                sale.
                            </div>
                        ) : (
                        <div className="rounded-xl bg-slate-50 px-3 py-2">
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 text-slate-500">
                                    <p className="truncate">
                                        Warehouse:{' '}
                                        <b className="text-slate-700">
                                            {warehouseName}
                                        </b>
                                    </p>
                                    <p className="truncate">
                                        Location:{' '}
                                        <b className="text-slate-700">
                                            {locationName}
                                        </b>
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setSwitchOpen((o) => !o)}
                                    className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[#1a9e52] hover:bg-emerald-50"
                                >
                                    <Warehouse size={14} />
                                    {switchOpen ? 'Done' : 'Change'}
                                </button>
                            </div>

                            {switchOpen && (
                                <div className="mt-3 space-y-2 border-t border-slate-200 pt-3">
                                    <div className="space-y-1">
                                        <Label>Warehouse</Label>
                                        <Select
                                            value={
                                                warehouseId
                                                    ? String(warehouseId)
                                                    : ''
                                            }
                                            onValueChange={(v) =>
                                                changeWarehouse(Number(v))
                                            }
                                        >
                                            <SelectTrigger className="bg-white">
                                                <SelectValue placeholder="Select a warehouse" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {warehouses.map((w) => (
                                                    <SelectItem
                                                        key={w.id}
                                                        value={String(w.id)}
                                                    >
                                                        {w.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1">
                                        <Label>Location</Label>
                                        <Select
                                            value={
                                                locationId
                                                    ? String(locationId)
                                                    : ''
                                            }
                                            onValueChange={(v) =>
                                                changeLocation(Number(v))
                                            }
                                            disabled={!warehouseId}
                                        >
                                            <SelectTrigger className="bg-white">
                                                <SelectValue placeholder="Select a location" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {locations.map((l) => (
                                                    <SelectItem
                                                        key={l.id}
                                                        value={String(l.id)}
                                                    >
                                                        {l.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    {lines.some((l) => l.track_serial) && (
                                        <p className="text-amber-600">
                                            Serials were cleared — stock differs
                                            per location. Pick them again.
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                        )}
                    </div>

                    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="flex items-end justify-between">
                            <span className="text-slate-500">Total</span>
                            <span className="text-3xl font-bold text-slate-900">
                                {money(grandTotal)}
                            </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            {METHODS.map((m) => {
                                const Icon = m.icon;
                                const active = method === m.value;
                                return (
                                    <button
                                        key={m.value}
                                        type="button"
                                        onClick={() => setMethod(m.value)}
                                        className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 font-medium transition ${
                                            active
                                                ? 'border-[#1a9e52] bg-emerald-50 text-[#1a9e52]'
                                                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                        }`}
                                    >
                                        <Icon size={16} /> {m.label}
                                    </button>
                                );
                            })}
                        </div>

                        {method === 'CASH' && (
                            <div className="space-y-1">
                                <Label>Cash received</Label>
                                <Input
                                    type="number"
                                    min={0}
                                    step="any"
                                    inputMode="decimal"
                                    value={tendered}
                                    onChange={(e) => setTendered(e.target.value)}
                                />
                                <div className="flex justify-between pt-1 text-slate-500">
                                    <span>Change</span>
                                    <b className="text-slate-800">
                                        {money(change)}
                                    </b>
                                </div>
                            </div>
                        )}

                        {error && (
                            <p className="rounded-xl bg-rose-50 px-3 py-2 text-rose-600">
                                {error}
                            </p>
                        )}

                        {/* On narrow screens the pay bar below owns this. */}
                        <Button
                            onClick={complete}
                            disabled={!canComplete}
                            className="hidden h-14 w-full bg-emerald-600 text-base font-semibold hover:bg-emerald-500 lg:flex"
                        >
                            {saving ? (
                                <>
                                    <Loader2
                                        size={18}
                                        className="mr-2 animate-spin"
                                    />
                                    Completing…
                                </>
                            ) : (
                                'Complete Sale'
                            )}
                        </Button>

                        {!serialsComplete && lines.length > 0 && (
                            <p className="text-center text-amber-600">
                                Select a serial for every unit before completing.
                            </p>
                        )}
                    </div>
                </aside>
            </div>

            {/* Pay bar — phones and tablets, where the checkout card is far down
                a long cart. The total and the pay button stay on screen so the
                cashier never scrolls to take money. Sits under the nav drawer. */}
            <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
                <div className="flex items-center gap-3 pl-14 sm:pl-0">
                    <div className="min-w-0">
                        <p className="text-slate-500">
                            {lines.length} item{lines.length === 1 ? '' : 's'}
                            {method === 'CASH' && Number(tendered) > 0 && (
                                <span className="ml-2">
                                    change{' '}
                                    <b className="text-slate-800">
                                        {money(change)}
                                    </b>
                                </span>
                            )}
                        </p>
                        <p className="truncate text-xl font-bold text-slate-900">
                            {money(grandTotal)}
                        </p>
                    </div>
                    <Button
                        onClick={complete}
                        disabled={!canComplete}
                        className="ml-auto h-12 flex-1 bg-emerald-600 text-sm font-semibold hover:bg-emerald-500"
                    >
                        {saving ? (
                            <Loader2 size={16} className="animate-spin" />
                        ) : (
                            'Complete Sale'
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}
