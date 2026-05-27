'use client';

import {
    EditableInput,
    EditableTextarea,
    FieldLabel,
} from '@/components/ui/FieldLabel';
import { ReadonlyInput } from '@/components/ui/Readonly';
import StockTransferModal from '@/components/forms/inventory/configurations/StockTransferModal';
import { DateTimeFormat } from '@/lib/utils/dateformat';
import { StockLocationProps } from '@/types/branch';
import {
    InventoryItemProps,
    TStockLogEntry,
} from '@/types/inventory/item';
import {
    AlertCircle,
    ArrowUpCircle,
    Box,
    CheckCircle2,
    ClipboardList,
    DollarSign,
    FileText,
    Hash,
    Loader2,
    MapPin,
    Plus,
    RefreshCw,
    Warehouse,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import StockAdjustmentModal, { StockAdjustmentData } from './StockAdjustmentModal';

type TabId = 'details' | 'history' | 'variant';

export interface StockBalanceWithLocation {
    id: number;
    quantity: number;
    location_id: number;
    updated_at: string;
    stock_location: {
        id: number;
        name: string;
        code: string | null;
        is_default: boolean;
        branch_id: number;
        warehouse: { id: number; name: string } | null;
    } | null;
}

// ─── Reason meta ──────────────────────────────────────────────────────────────

const REASON_META: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
    'Opening Warehouse Inventory Balance Setup': {
        label: 'Opening Balance',
        color: 'text-blue-700',
        bg: 'bg-blue-50 border-blue-200',
        icon: <Warehouse size={12} />,
    },
    'Cycle Count Correction': {
        label: 'Cycle Count',
        color: 'text-violet-700',
        bg: 'bg-violet-50 border-violet-200',
        icon: <RefreshCw size={12} />,
    },
    'Direct Manual Vendor Arrival': {
        label: 'Vendor Arrival',
        color: 'text-emerald-700',
        bg: 'bg-emerald-50 border-emerald-200',
        icon: <ArrowUpCircle size={12} />,
    },
};

function getReasonMeta(reason: string) {
    return (
        REASON_META[reason] ?? {
            label: reason,
            color: 'text-gray-600',
            bg: 'bg-gray-50 border-gray-200',
            icon: <ClipboardList size={12} />,
        }
    );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeading({
    icon,
    title,
    subtitle,
}: {
    icon: React.ReactNode;
    title: string;
    subtitle?: string;
}) {
    return (
        <div className="flex items-start gap-3 mb-5">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                {icon}
            </div>
            <div>
                <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
                {subtitle && (
                    <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>
                )}
            </div>
        </div>
    );
}

function getStockOnHand(stock: InventoryItemProps['stock']) {
    if (typeof stock === 'number') return stock;
    return stock?.stock_onhand ?? 0;
}

function getReservedStock(stock: InventoryItemProps['stock']) {
    if (typeof stock === 'number') return 0;
    return stock?.stock_reserved ?? 0;
}

function StockByLocationSection({
    itemId,
    stockBalances,
    onOpenTransfer,
}: {
    itemId: number;
    stockBalances: StockBalanceWithLocation[];
    onOpenTransfer: (fromLocationId: number, itemId: number) => void;
}) {
    const total = stockBalances.reduce(
        (sum, balance) => sum + Number(balance.quantity ?? 0),
        0,
    );

    return (
        <div className="mt-5 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
                <MapPin size={15} className="text-blue-500" />
                Stock by Location
            </h3>

            {stockBalances.length === 0 ? (
                <p className="text-xs text-slate-400">
                    មិនមានស្តុកក្នុងទីតាំងណាមួយទេ
                </p>
            ) : (
                <div className="space-y-2">
                    {stockBalances.map((balance) => (
                        <div
                            key={balance.id}
                            className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5"
                        >
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    {balance.stock_location?.code && (
                                        <span className="rounded bg-blue-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-blue-700">
                                            {balance.stock_location.code}
                                        </span>
                                    )}
                                    <span className="text-sm font-medium text-slate-700">
                                        {balance.stock_location?.name ?? 'Unknown'}
                                    </span>
                                    {balance.stock_location?.is_default && (
                                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-600">
                                            Default
                                        </span>
                                    )}
                                </div>
                                <p className="mt-0.5 text-[11px] text-slate-400">
                                    {balance.stock_location?.warehouse?.name ?? '—'}
                                </p>
                            </div>
                            <div className="ml-3 flex shrink-0 items-center gap-3">
                                <span className="font-mono text-base font-bold text-slate-800">
                                    {balance.quantity}
                                </span>
                                <button
                                    type="button"
                                    onClick={() =>
                                        onOpenTransfer(balance.location_id, itemId)
                                    }
                                    className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-100"
                                >
                                    Transfer -&gt;
                                </button>
                            </div>
                        </div>
                    ))}

                    <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-2">
                        <span className="text-xs font-semibold text-slate-500">
                            Total
                        </span>
                        <span className="font-mono text-base font-bold text-slate-800">
                            {total}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Stock Banner ─────────────────────────────────────────────────────────────

function StockBanner({
    stock,
    itemId,
    stockBalances,
    onOpenStockModal,
    onOpenTransfer,
}: {
    stock: InventoryItemProps['stock'];
    itemId: number;
    stockBalances: StockBalanceWithLocation[];
    onOpenStockModal: () => void; // required — not optional
    onOpenTransfer: (fromLocationId: number, itemId: number) => void;
}) {
    const available = Math.max(
        0,
        getStockOnHand(stock) - getReservedStock(stock),
    );

    const counts = [
        { label: 'Physical on hand', value: getStockOnHand(stock) },
        { label: 'Reserved (sold)', value: getReservedStock(stock) },
        { label: 'Available to sell', value: available },
    ];

    return (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <div className="flex flex-wrap items-stretch">
                <div className="flex-1 min-w-65 border-r border-gray-100 px-6 py-5">
                    <div className="flex justify-between items-center gap-2">
                        <div>
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-600" />
                            <p className="text-[11px] font-medium uppercase tracking-widest text-amber-700">
                                Current Stockroom Inventory
                            </p>
                        </div>

                        {/* ── Button now calls onOpenStockModal ── */}
                        <div className="flex items-center justify-center px-6 py-5">
                            <button
                                type="button"
                                onClick={onOpenStockModal}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-medium text-amber-50 transition hover:bg-amber-700 active:scale-95 whitespace-nowrap"
                            >
                                <Plus size={15} strokeWidth={2} />
                                Log initial stock balance
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 divide-x divide-gray-200 overflow-hidden rounded-lg">
                        {counts.map(({ label, value }) => (
                            <div key={label} className="px-3 py-3.5 text-center bg-gray-50">
                                <p className="text-2xl font-medium leading-none text-green-700">
                                    {value}
                                </p>
                                <p className="mt-1.5 text-[11px] leading-snug text-gray-500">
                                    {label}
                                </p>
                            </div>
                        ))}
                    </div>

                    <StockByLocationSection
                        itemId={itemId}
                        stockBalances={stockBalances}
                        onOpenTransfer={onOpenTransfer}
                    />
                </div>
            </div>
        </div>
    );
}

function NonStockBanner() {
    return (
        <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-5 py-4">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
            <p className="text-sm text-slate-500 leading-relaxed">
                Inventory tracking is completely disabled for non-stock entries and services.
            </p>
        </div>
    );
}

// ─── Tab: Item Details ────────────────────────────────────────────────────────

function DetailsTab({
    item,
    isStock,
}: {
    item: InventoryItemProps;
    isStock: boolean;
}) {
    return (
        <div className="p-6 md:p-8">
            <div className="grid gap-8">
                <div className="space-y-8">
                    <section>
                        <SectionHeading
                            icon={<Box size={15} />}
                            title="Product Information"
                            subtitle="Manage item name, class, and core identifiers"
                        />
                        <div className="grid gap-5 lg:grid-cols-2">
                            <div>
                                <FieldLabel>SKU / Reference No.</FieldLabel>
                                <EditableInput
                                    type="text"
                                    name="reference_no"
                                    defaultValue={item.reference_no}
                                    placeholder="SKU-000000"
                                />
                            </div>
                            <div className="sm:col-span-1">
                                <FieldLabel required>Item Name</FieldLabel>
                                <EditableInput
                                    type="text"
                                    name="name"
                                    defaultValue={item.name}
                                    placeholder="e.g. iPhone Case, Premium Headphones…"
                                />
                            </div>
                            <div>
                                <FieldLabel>Category</FieldLabel>
                                <EditableInput
                                    type="text"
                                    name="category.name"
                                    defaultValue={item.category?.name}
                                    placeholder="e.g. Electronics"
                                />
                            </div>
                            <div>
                                <FieldLabel>Base UOM</FieldLabel>
                                <EditableInput
                                    type="text"
                                    name="uom.name"
                                    defaultValue={item.uom?.name}
                                    placeholder="e.g. Piece, Box"
                                />
                            </div>
                            <div>
                                <FieldLabel>Tracking Class</FieldLabel>
                                <ReadonlyInput
                                    value={isStock ? 'Stocked Physical Good' : 'Non-Stock / Service'}
                                />
                            </div>
                            <div>
                                <div>
                                    <FieldLabel>Stock Location</FieldLabel>
                                    <ReadonlyInput
                                        value={
                                            isStock
                                                ? item.stock_location
                                                    ? `${item.stock_location.branch_name ?? ''} → ${item.stock_location.location_name ?? '—'} (${item.stock_location.quantity} units)`
                                                    : 'No stock placed yet'
                                                : 'Not applicable'
                                        }
                                    />
                                </div>
                            </div>
                            <div className="sm:col-span-2">
                                <FieldLabel>Additional Notes</FieldLabel>
                                <EditableTextarea
                                    name="description"
                                    defaultValue={item.description ?? ''}
                                    placeholder="Internal notes, usage context, supplier info…"
                                />
                            </div>
                        </div>
                    </section>

                    <div className="border-t border-dashed border-slate-100" />

                    <section>
                        <SectionHeading
                            icon={<DollarSign size={15} />}
                            title="Pricing Details"
                            subtitle="Cost basis, retail price, and internal valuation"
                        />
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                                <FieldLabel required>Purchase Price ($)</FieldLabel>
                                <EditableInput
                                    type="number"
                                    name="purchase_price"
                                    min="0"
                                    step="0.01"
                                    defaultValue={item.purchase_price}
                                    placeholder="0.00"
                                />
                                <p className="mt-1 text-[10px] text-slate-400">Cost basis / landed cost</p>
                            </div>
                            <div>
                                <FieldLabel required>Sale Price ($)</FieldLabel>
                                <EditableInput
                                    type="number"
                                    name="sale_price"
                                    min="0"
                                    step="0.01"
                                    defaultValue={item.sale_price}
                                    placeholder="0.00"
                                />
                                <p className="mt-1 text-[10px] text-slate-400">MSRP / retail price</p>
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}

// ─── Tab: Stock Balance History ───────────────────────────────────────────────

function HistoryTab({
    itemId,
    refreshKey,
}: {
    itemId: number | string;
    refreshKey: number; // increments after every successful submission → triggers re-fetch
}) {
    const [logs, setLogs]       = useState<TStockLogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError]     = useState<string | null>(null);

    // ── Fetch logs ──────────────────────────────────────────────────
    useEffect(() => {
        let cancelled = false;

        fetch(`/api/inventory/${itemId}`, { method: 'GET' })
            .then((r) => {
                if (!r.ok) throw new Error(`Server error ${r.status}`);
                return r.json();
            })
            .then((json) => {
                if (!cancelled) {
                    setLogs(json.data?.stock_entry ?? []);
                    setError(null);
                }
            })
            .catch((err) => {
                if (!cancelled) setError(err.message ?? 'Failed to load history.');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => { cancelled = true; };
    }, [itemId, refreshKey]); // re-runs whenever refreshKey changes

    // ── Loading ─────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-400">
                <Loader2 size={24} className="animate-spin" />
                <p className="text-xs">Loading stock history…</p>
            </div>
        );
    }

    // ── Error ───────────────────────────────────────────────────────
    if (error) {
        return (
            <div className="flex flex-col items-center justify-center gap-3 py-20 px-6 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
                    <AlertCircle size={20} className="text-red-400" />
                </div>
                <div>
                    <p className="text-sm font-semibold text-slate-600">Failed to load history</p>
                    <p className="mt-1 text-xs text-red-400">{error}</p>
                </div>
            </div>
        );
    }

    // ── Empty ───────────────────────────────────────────────────────
    if (logs.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center gap-4 py-20 px-6 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50">
                    <ClipboardList size={22} className="text-slate-300" />
                </div>
                <div>
                    <p className="text-sm font-semibold text-slate-600">No adjustment logs yet</p>
                    <p className="mt-1 text-xs text-slate-400">
                        Stock balance entries will appear here after you post an adjustment.
                    </p>
                </div>
            </div>
        );
    }

    // ── Ledger table ────────────────────────────────────────────────
    const rowsWithRunning = logs.reduce<
        { entry: TStockLogEntry; idx: number; running: number }[]
    >((acc, entry, idx) => {
        const previous = acc[idx - 1]?.running ?? 0;
        return [...acc, { entry, idx, running: previous + entry.quantity }];
    }, []);
    const cumulative = rowsWithRunning.at(-1)?.running ?? 0;

    return (
        <div className="p-4 space-y-6">
            <div className="overflow-hidden rounded-xl border border-slate-200">
                {/* Header */}
                <div className="grid grid-cols-[2rem_1fr_6rem_8rem_7rem] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
                    {['#', 'Reason', 'Qty', 'Running Total', 'Date'].map((h) => (
                        <p key={h} className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                            {h}
                        </p>
                    ))}
                </div>

                {/* Rows */}
                <div className="divide-y divide-slate-100">
                    {rowsWithRunning.map(({ entry, idx, running }) => {
                        const meta = getReasonMeta(entry.reason);

                        return (
                            <div
                                key={entry.id}
                                className="grid grid-cols-[2rem_1fr_6rem_8rem_7rem] items-center gap-3 px-4 py-3.5 transition hover:bg-slate-50/80"
                            >
                                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100">
                                    <span className="text-[9px] font-bold text-slate-500">{idx + 1}</span>
                                </div>

                                <div className="min-w-0">
                                    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold ${meta.bg} ${meta.color}`}>
                                        {meta.icon}
                                        {meta.label}
                                    </span>
                                    {entry.reference && (
                                        <p className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-400">
                                            <Hash size={9} />
                                            {entry.reference}
                                        </p>
                                    )}
                                </div>

                                <div className="flex items-center gap-1">
                                    <CheckCircle2 size={13} className="text-emerald-500" />
                                    <span className="text-sm font-bold text-emerald-700">+{entry.quantity}</span>
                                </div>

                                <div className="flex items-center gap-1.5">
                                    <div className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                                    <span className="text-sm font-semibold text-slate-700">{running} units</span>
                                </div>

                                <div>
                                    <p className="text-xs font-medium text-slate-600">
                                        {DateTimeFormat(entry.posted_at)}
                                    </p>
                                    <p className="text-[10px] text-slate-400">
                                        {entry.posted_by}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-2.5">
                    <p className="text-[10px] text-slate-400">
                        {logs.length} {logs.length === 1 ? 'entry' : 'entries'} total
                    </p>
                    <p className="text-[10px] font-semibold text-slate-600">
                        Cumulative: <span className="text-blue-700">{cumulative} units</span>
                    </p>
                </div>
            </div>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ProductDashboard({
    item,
    stockBalances = [],
    autoOpenStockModal = false,
}: {
    item: InventoryItemProps;
    stockBalances?: StockBalanceWithLocation[];
    autoOpenStockModal?: boolean;
}) {
    const router = useRouter();
    const [activeTab, setActiveTab]         = useState<TabId>('details');
    const [isStockModalOpen, setIsStockModalOpen] = useState(autoOpenStockModal);
    const [isSubmitting, setIsSubmitting]   = useState(false);
    // Increment to trigger HistoryTab re-fetch after a successful submission
    const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
    const [locations, setLocations] = useState<StockLocationProps[]>([]);
    const [showTransfer, setShowTransfer] = useState(false);
    const [transferFromId, setTransferFromId] = useState<number | null>(null);
    const [transferItemId, setTransferItemId] = useState<number | null>(null);

    const isStock = item.item_class === 'stock';
    const stock   = item.stock;
    const log     = item.stock_entry ?? [];

    useEffect(() => {
        let cancelled = false;

        fetch('/api/stock-location')
            .then((res) => res.json().then((json) => ({ ok: res.ok, json })))
            .then(({ ok, json }) => {
                if (!cancelled && ok) {
                    setLocations(json.data ?? []);
                }
            })
            .catch(() => {
                if (!cancelled) setLocations([]);
            });

        return () => {
            cancelled = true;
        };
    }, []);

    const openTransferModal = useCallback(
        (fromLocationId: number, itemId: number) => {
            setTransferFromId(fromLocationId);
            setTransferItemId(itemId);
            setShowTransfer(true);
        },
        [],
    );

    const transferBranchId =
        stockBalances.find((balance) => balance.location_id === transferFromId)
            ?.stock_location?.branch_id ??
        stockBalances[0]?.stock_location?.branch_id ??
        0;
    const transferLocations = transferBranchId
        ? locations.filter((location) => location.branch_id === transferBranchId)
        : locations;

    // ── Submit handler ────────────────────────────────────────────────
    const handleStockSubmit = useCallback(async (data: StockAdjustmentData) => {
        setIsSubmitting(true);
        try {
            const res = await fetch(`/api/inventory/${item.id}/adjust`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    received_quantity: data.quantity,
                    adjustment_reason: data.reason,
                    location_id: data.location_id,
                    movement_type: 'in',
                }),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err?.message ?? `Server error ${res.status}`);
            }

            setIsStockModalOpen(false);
            setHistoryRefreshKey((k) => k + 1); // triggers HistoryTab re-fetch
            router.refresh();
            // Switch to history tab so user sees the new entry immediately
            setActiveTab('history');
        } catch (err) {
            console.error('Stock adjustment failed:', err);
            alert(err instanceof Error ? err.message : 'Submission failed. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    }, [item.id, router]);

    const tabs: { id: TabId; label: string; icon: React.ReactNode; badge?: number }[] = [
        { id: 'details', label: 'Item Details', icon: <FileText size={14} /> },
        ...(isStock
            ? [{
                id: 'history' as TabId,
                label: 'Stock Balance History',
                icon: <ClipboardList size={14} />,
                badge: log.length,
            }]
            : [{
                id: 'variant' as TabId,
                label: 'Item Variant',
                icon: <ClipboardList size={14} />,
                badge: log.length,
            }]
        ),
    ];

    return (
        <div className="min-h-screen bg-gray-50 px-4 py-8 md:px-8">
            <div className="mx-auto space-y-5">

                {/* ── Inventory Status Banner ── */}
                {isStock ? (
                    <StockBanner
                        stock={stock}
                        itemId={item.id ?? 0}
                        stockBalances={stockBalances}
                        onOpenStockModal={() => setIsStockModalOpen(true)} // ✅ wired up
                        onOpenTransfer={openTransferModal}
                    />
                ) : (
                    <NonStockBanner />
                )}

                {/* ── Stock Adjustment Modal ── */}
                <StockAdjustmentModal
                    isOpen={isStockModalOpen}
                    onClose={() => setIsStockModalOpen(false)}
                    onSubmit={handleStockSubmit}
                    isLoading={isSubmitting}
                    locations={locations}
                />

                {showTransfer && (
                    <StockTransferModal
                        branchId={transferBranchId}
                        locations={transferLocations}
                        preselectedFromId={transferFromId}
                        preselectedItemId={transferItemId}
                        onClose={() => setShowTransfer(false)}
                        onSuccess={() => {
                            setShowTransfer(false);
                            router.refresh();
                        }}
                    />
                )}

                {/* ── Main card with tabs ── */}
                <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                    {/* Tab bar */}
                    <div className="flex items-center border-b border-gray-100 px-6">
                        {tabs.map((tab) => {
                            const active = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`relative flex items-center gap-2 px-1 py-4 mr-6 text-sm font-medium transition-colors ${
                                        active ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'
                                    }`}
                                >
                                    {tab.icon}
                                    {tab.label}
                                    {tab.badge !== undefined && tab.badge > 0 && (
                                        <span className={`inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                                            active ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
                                        }`}>
                                            {tab.badge}
                                        </span>
                                    )}
                                    {active && (
                                        <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-blue-600" />
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Tab content */}
                    {activeTab === 'details' && (
                        <DetailsTab item={item} isStock={isStock} />
                    )}
                    {activeTab === 'history' && (
                        <HistoryTab
                            itemId={item.id!}
                            refreshKey={historyRefreshKey} // ✅ re-fetches after submit
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
