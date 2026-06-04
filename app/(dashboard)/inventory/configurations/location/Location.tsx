'use client';

import StockLocationForm from '@/components/forms/inventory/configurations/StockLocationForm';
import StockTransferModal from '@/components/forms/inventory/configurations/StockTransferModal';
import { StockLocationProps } from '@/types/branch';
import {
    ArrowLeft,
    ArrowRightLeft,
    Box,
    Edit2,
    Eye,
    GripVertical,
    LayoutGrid,
    MapPin,
    Package,
    Plus,
    Search,
    Star,
    Trash2,
    Warehouse,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useRef, useState } from 'react';

/* ─────────────────────── Types ─────────────────────── */

interface BalanceRow {
    id: number;
    quantity: number;
    item_id: number;
    location_id: number;
    inventory_item: {
        id: number;
        name: string;
        sku: string | null;
        reference_no: string;
        price: number;
        sale_price: number | null;
        images_url: any;
    };
}

interface BranchData {
    id: number;
    name: string;
    reference_no: string;
    is_active: boolean;
}

interface Props {
    branch: BranchData;
    locations: StockLocationProps[];
    balances: BalanceRow[];
    userRole: string | null;
}

type ViewMode = 'rack' | 'floorplan';

/* ─────────────────────── Helpers ─────────────────────── */

const RACK_COLORS = [
    { bg: 'bg-blue-50', border: 'border-blue-200', accent: 'bg-blue-600', text: 'text-blue-700', light: 'bg-blue-100' },
    { bg: 'bg-amber-50', border: 'border-amber-200', accent: 'bg-amber-600', text: 'text-amber-700', light: 'bg-amber-100' },
    { bg: 'bg-emerald-50', border: 'border-emerald-200', accent: 'bg-emerald-600', text: 'text-emerald-700', light: 'bg-emerald-100' },
    { bg: 'bg-rose-50', border: 'border-rose-200', accent: 'bg-rose-600', text: 'text-rose-700', light: 'bg-rose-100' },
    { bg: 'bg-violet-50', border: 'border-violet-200', accent: 'bg-violet-600', text: 'text-violet-700', light: 'bg-violet-100' },
    { bg: 'bg-cyan-50', border: 'border-cyan-200', accent: 'bg-cyan-600', text: 'text-cyan-700', light: 'bg-cyan-100' },
];

function getCapacityLevel(count: number) {
    if (count === 0) return { label: 'Empty', color: 'text-slate-400' };
    if (count <= 5) return { label: 'Low', color: 'text-amber-500' };
    if (count <= 15) return { label: 'Medium', color: 'text-blue-500' };
    return { label: 'Full', color: 'text-emerald-500' };
}

/* ─────────────────── Shelf Bin (small box on rack) ─────────────────── */

function ShelfBin({
    item,
    onDragStart,
    locationId,
}: {
    item?: BalanceRow;
    onDragStart?: (e: React.DragEvent, item: BalanceRow, fromLocationId: number) => void;
    locationId: number;
}) {
    if (!item) {
        return (
            <div className="flex h-14 w-full items-center justify-center rounded-lg border-2 border-dashed border-slate-100 bg-slate-50/50 transition-colors" />
        );
    }

    return (
        <div
            draggable
            onDragStart={(e) => onDragStart?.(e, item, locationId)}
            className="group/bin relative flex h-14 w-full cursor-grab items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 shadow-sm transition-all hover:border-blue-300 hover:shadow-md active:cursor-grabbing active:shadow-lg"
            title={`${item.inventory_item.name} — qty: ${item.quantity}`}
        >
            <GripVertical size={12} className="shrink-0 text-slate-300 group-hover/bin:text-blue-400" />
            <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-semibold text-slate-700">
                    {item.inventory_item.name}
                </p>
                <p className="text-[10px] text-slate-400">
                    {item.inventory_item.sku ?? item.inventory_item.reference_no} ×{item.quantity}
                </p>
            </div>
        </div>
    );
}

/* ─────────────────── Shelf Rack Card ─────────────────── */

function ShelfRack({
    location,
    items,
    colorSet,
    index,
    onEdit,
    onDelete,
    onDragStart,
    onDrop,
    onDragOver,
    onTransfer,
    onViewItems,
}: {
    location: StockLocationProps;
    items: BalanceRow[];
    colorSet: (typeof RACK_COLORS)[0];
    index: number;
    onEdit: () => void;
    onDelete: () => void;
    onDragStart: (e: React.DragEvent, item: BalanceRow, fromLocationId: number) => void;
    onDrop: (e: React.DragEvent, toLocationId: number) => void;
    onDragOver: (e: React.DragEvent) => void;
    onTransfer: () => void;
    onViewItems: () => void;
}) {
    const [isDragOver, setIsDragOver] = useState(false);
    const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
    const level = getCapacityLevel(totalItems);
    const displayItems = items.slice(0, 6);
    const emptySlots = Math.max(0, 6 - displayItems.length);

    return (
        <div
            className={`group relative rounded-2xl border-2 transition-all duration-300 ${
                isDragOver
                    ? 'border-blue-400 bg-blue-50/50 shadow-lg shadow-blue-100 scale-[1.02]'
                    : `${colorSet.border} bg-white shadow-sm hover:shadow-md`
            } ${!location.is_active ? 'opacity-50' : ''}`}
            style={{ animationDelay: `${index * 60}ms` }}
            onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
                onDragOver(e);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
                setIsDragOver(false);
                onDrop(e, location.id);
            }}
        >
            {/* Rack Header — like a physical shelf label */}
            <div
                className={`flex items-center justify-between rounded-t-xl ${colorSet.accent} px-4 py-2.5`}
            >
                <div className="flex items-center gap-2">
                    <Warehouse size={14} className="text-white/80" />
                    <span className="font-mono text-xs font-bold tracking-wider text-white">
                        {location.code || '—'}
                    </span>
                    {location.is_default && (
                        <span className="flex items-center gap-0.5 rounded bg-white/20 px-1.5 py-0.5 text-[9px] font-bold text-white">
                            <Star size={8} fill="currentColor" />
                            DEFAULT
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={onEdit}
                        className="rounded p-1 text-white/60 transition-colors hover:bg-white/20 hover:text-white"
                    >
                        <Edit2 size={12} />
                    </button>
                    <button
                        onClick={onDelete}
                        className="rounded p-1 text-white/60 transition-colors hover:bg-white/20 hover:text-white"
                    >
                        <Trash2 size={12} />
                    </button>
                </div>
            </div>

            {/* Shelf Contents — Grid of bins */}
            <div className="px-3 py-3">
                <div className="mb-2 flex items-center justify-between">
                    <h3 className="truncate text-sm font-semibold text-slate-800">
                        {location.name}
                    </h3>
                    <span className={`text-[10px] font-bold ${level.color}`}>{level.label}</span>
                </div>

                {/* Bin grid — represents physical compartments */}
                <div className="grid grid-cols-2 gap-1.5">
                    {displayItems.map((item) => (
                        <ShelfBin
                            key={item.id}
                            item={item}
                            onDragStart={onDragStart}
                            locationId={location.id}
                        />
                    ))}
                    {Array.from({ length: emptySlots }).map((_, i) => (
                        <ShelfBin key={`empty-${i}`} locationId={location.id} />
                    ))}
                </div>

                {items.length > 6 && (
                    <p className="mt-1.5 text-center text-[10px] text-slate-400">
                        +{items.length - 6} more items
                    </p>
                )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2">
                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                    <Package size={12} />
                    <span className="font-semibold">{totalItems}</span> units ·{' '}
                    <span>{items.length}</span> SKUs
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={onViewItems}
                        className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-50 hover:text-blue-600"
                        title="View all items"
                    >
                        <Eye size={13} />
                    </button>
                    <button
                        onClick={onTransfer}
                        className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-50 hover:text-blue-600"
                        title="Transfer stock"
                    >
                        <ArrowRightLeft size={13} />
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ─────────────────── Floor Plan Grid ─────────────────── */

function FloorPlanView({
    locations,
    balancesByLocation,
    onSelectLocation,
}: {
    locations: StockLocationProps[];
    balancesByLocation: Map<number, BalanceRow[]>;
    onSelectLocation: (loc: StockLocationProps) => void;
}) {
    const cols = Math.min(Math.ceil(Math.sqrt(locations.length + 1)), 4);

    return (
        <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100 p-6">
            {/* Floor plan header */}
            <div className="mb-4 flex items-center gap-2 text-sm text-slate-500">
                <MapPin size={14} />
                <span className="font-medium">Floor Plan View</span>
                <span className="text-xs text-slate-400">— Click a zone to view details</span>
            </div>

            {/* Grid map */}
            <div
                className="grid gap-3"
                style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
            >
                {locations.map((loc, i) => {
                    const items = balancesByLocation.get(loc.id) ?? [];
                    const totalQty = items.reduce((s, b) => s + b.quantity, 0);
                    const colorSet = RACK_COLORS[i % RACK_COLORS.length];
                    const fillPercent = Math.min(totalQty / 50, 1); // normalized to 50 max for visual

                    return (
                        <button
                            key={loc.id}
                            onClick={() => onSelectLocation(loc)}
                            className={`relative flex flex-col items-center justify-center rounded-xl border-2 ${colorSet.border} ${colorSet.bg} p-4 text-center transition-all hover:scale-105 hover:shadow-lg ${
                                !loc.is_active ? 'opacity-40 grayscale' : ''
                            }`}
                            style={{ minHeight: 100 }}
                        >
                            {/* Fill indicator */}
                            <div
                                className={`absolute inset-0 rounded-xl ${colorSet.light} transition-all`}
                                style={{
                                    clipPath: `inset(${100 - fillPercent * 100}% 0 0 0)`,
                                    opacity: 0.5,
                                }}
                            />

                            <div className="relative z-10">
                                <span className={`font-mono text-xs font-bold ${colorSet.text}`}>
                                    {loc.code || '—'}
                                </span>
                                <p className="mt-1 text-[11px] font-semibold text-slate-700">
                                    {loc.name}
                                </p>
                                <div className="mt-2 flex items-center justify-center gap-1">
                                    <Box size={10} className="text-slate-400" />
                                    <span className="text-xs font-bold text-slate-600">
                                        {totalQty}
                                    </span>
                                </div>
                                {loc.is_default && (
                                    <Star
                                        size={10}
                                        fill="currentColor"
                                        className="absolute -right-1 -top-1 text-amber-500"
                                    />
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Legend */}
            <div className="mt-4 flex flex-wrap items-center gap-4 text-[10px] text-slate-400">
                <span className="flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded bg-emerald-200" /> High Stock
                </span>
                <span className="flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded bg-amber-200" /> Medium
                </span>
                <span className="flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded bg-slate-200" /> Empty
                </span>
            </div>
        </div>
    );
}

/* ─────────────────── Location Detail Drawer ─────────────────── */

function LocationDrawer({
    location,
    items,
    onClose,
    onTransfer,
}: {
    location: StockLocationProps;
    items: BalanceRow[];
    onClose: () => void;
    onTransfer: (itemId: number) => void;
}) {
    const [search, setSearch] = useState('');
    const totalQty = items.reduce((s, i) => s + i.quantity, 0);

    const filtered = items.filter(
        (i) =>
            i.inventory_item.name.toLowerCase().includes(search.toLowerCase()) ||
            (i.inventory_item.sku ?? '').toLowerCase().includes(search.toLowerCase()),
    );

    return (
        <div
            className="fixed inset-0 z-40 flex justify-end bg-black/30 backdrop-blur-sm"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div className="h-full w-full max-w-md animate-in slide-in-from-right duration-300 overflow-y-auto bg-white shadow-2xl">
                {/* Header */}
                <div className="sticky top-0 z-10 border-b border-slate-100 bg-white px-5 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="rounded bg-blue-100 px-2 py-0.5 font-mono text-xs font-bold text-blue-700">
                                    {location.code}
                                </span>
                                <h2 className="text-base font-semibold text-slate-800">
                                    {location.name}
                                </h2>
                            </div>
                            <p className="mt-1 text-xs text-slate-400">
                                {items.length} SKUs · {totalQty} total units
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100"
                        >
                            ✕
                        </button>
                    </div>

                    {/* Search */}
                    <div className="relative mt-3">
                        <Search
                            size={14}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                        />
                        <input
                            type="text"
                            placeholder="Search items..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
                        />
                    </div>
                </div>

                {/* Item list */}
                <div className="divide-y divide-slate-50 px-5">
                    {filtered.length === 0 ? (
                        <div className="py-12 text-center">
                            <Package className="mx-auto h-8 w-8 text-slate-300" />
                            <p className="mt-2 text-sm text-slate-400">No items found</p>
                        </div>
                    ) : (
                        filtered.map((item) => (
                            <div
                                key={item.id}
                                className="flex items-center gap-3 py-3"
                            >
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                                    <Package size={16} className="text-slate-400" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium text-slate-800">
                                        {item.inventory_item.name}
                                    </p>
                                    <p className="text-xs text-slate-400">
                                        {item.inventory_item.sku ?? item.inventory_item.reference_no}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="font-mono text-sm font-bold text-slate-700">
                                        {item.quantity}
                                    </p>
                                    <button
                                        onClick={() => onTransfer(item.item_id)}
                                        className="mt-0.5 text-[10px] font-medium text-blue-500 hover:underline"
                                    >
                                        Transfer →
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

/* ═══════════════════════ MAIN COMPONENT ═══════════════════════ */

export default function BranchDetailClient({ branch, locations, balances, userRole }: Props) {
    const router = useRouter();

    // ── State ──
    const [search, setSearch] = useState('');
    const [viewMode, setViewMode] = useState<ViewMode>('rack');
    const [showLocationForm, setShowLocationForm] = useState(false);
    const [editingLocation, setEditingLocation] = useState<StockLocationProps | null>(null);
    const [showTransfer, setShowTransfer] = useState(false);
    const [transferFromId, setTransferFromId] = useState<number | null>(null);
    const [transferItemId, setTransferItemId] = useState<number | null>(null);
    const [viewingLocation, setViewingLocation] = useState<StockLocationProps | null>(null);
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

    // ── Derived data ──
    const balancesByLocation = useMemo(() => {
        const map = new Map<number, BalanceRow[]>();
        for (const b of balances) {
            const arr = map.get(b.location_id) ?? [];
            arr.push(b);
            map.set(b.location_id, arr);
        }
        return map;
    }, [balances]);

    const filteredLocations = useMemo(
        () =>
            locations.filter(
                (l) =>
                    l.name.toLowerCase().includes(search.toLowerCase()) ||
                    (l.code ?? '').toLowerCase().includes(search.toLowerCase()),
            ),
        [locations, search],
    );

    const totalItems = balances.reduce((s, b) => s + b.quantity, 0);
    const totalSKUs = new Set(balances.map((b) => b.item_id)).size;

    // ── Handlers ──
    const showToast = (msg: string, type: 'success' | 'error') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const onDeleteLocation = async (id: number) => {
        if (!confirm('Delete this location? Stock balances will be affected.')) return;
        try {
            const res = await fetch(`/api/stock-location/${id}`, { method: 'DELETE' });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error ?? 'Delete failed');
            showToast('Location deleted.', 'success');
            router.refresh();
        } catch (err: any) {
            showToast(err.message, 'error');
        }
    };

    const openTransfer = (fromId?: number, itemId?: number) => {
        setTransferFromId(fromId ?? null);
        setTransferItemId(itemId ?? null);
        setShowTransfer(true);
    };

    // ── Drag & Drop ──
    const dragDataRef = useRef<{ item: BalanceRow; fromLocationId: number } | null>(null);

    const handleDragStart = useCallback(
        (e: React.DragEvent, item: BalanceRow, fromLocationId: number) => {
            dragDataRef.current = { item, fromLocationId };
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', String(item.item_id));
        },
        [],
    );

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }, []);

    const handleDrop = useCallback(
        async (e: React.DragEvent, toLocationId: number) => {
            e.preventDefault();
            const dragData = dragDataRef.current;
            if (!dragData) return;
            if (dragData.fromLocationId === toLocationId) return;

            // Ask quantity
            const maxQty = dragData.item.quantity;
            const input = prompt(
                `Transfer "${dragData.item.inventory_item.name}" to this location.\nMax available: ${maxQty}\n\nQuantity:`,
                String(maxQty),
            );
            if (!input) return;

            const qty = Number(input);
            if (!qty || qty <= 0 || qty > maxQty) {
                showToast('Invalid quantity.', 'error');
                return;
            }

            try {
                const res = await fetch('/api/stock-transfer', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        item_id: dragData.item.item_id,
                        from_location_id: dragData.fromLocationId,
                        to_location_id: toLocationId,
                        quantity: qty,
                        reason: 'Drag & drop transfer',
                    }),
                });
                const json = await res.json();
                if (!res.ok) throw new Error(json.error ?? 'Transfer failed');
                showToast('Stock transferred!', 'success');
                router.refresh();
            } catch (err: any) {
                showToast(err.message, 'error');
            }

            dragDataRef.current = null;
        },
        [router],
    );

    return (
        <>
            {/* Toast */}
            {toast && (
                <div
                    className={`fixed right-4 top-4 z-[60] rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${
                        toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
                    }`}
                >
                    {toast.msg}
                </div>
            )}

            {/* Modals */}
            {(showLocationForm || editingLocation) && (
                <StockLocationForm
                    branchId={branch.id}
                    location={editingLocation}
                    onClose={() => {
                        setShowLocationForm(false);
                        setEditingLocation(null);
                    }}
                    onSuccess={() => {
                        showToast(editingLocation ? 'Location updated.' : 'Location created.', 'success');
                        router.refresh();
                    }}
                />
            )}

            {showTransfer && (
                <StockTransferModal
                    branchId={branch.id}
                    locations={locations}
                    preselectedFromId={transferFromId}
                    preselectedItemId={transferItemId}
                    onClose={() => setShowTransfer(false)}
                    onSuccess={() => showToast('Stock transferred!', 'success')}
                />
            )}

            {viewingLocation && (
                <LocationDrawer
                    location={viewingLocation}
                    items={balancesByLocation.get(viewingLocation.id) ?? []}
                    onClose={() => setViewingLocation(null)}
                    onTransfer={(itemId) => {
                        setViewingLocation(null);
                        openTransfer(viewingLocation.id, itemId);
                    }}
                />
            )}

            {/* Page */}
            <div className="mx-auto animate-in fade-in duration-500 p-4 md:p-8">
                {/* Breadcrumb + Header */}
                <div className="mb-6">
                    <Link
                        href="/inventory/configurations/location"
                        className="mb-3 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-600"
                    >
                        <ArrowLeft size={14} />
                        Back to Branches
                    </Link>

                    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                        <div>
                            <h1 className="flex items-center gap-3 text-2xl font-bold text-slate-800">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
                                    <Warehouse size={20} />
                                </div>
                                {branch.name}
                            </h1>
                            <p className="mt-1 ml-[52px] text-sm text-slate-500">
                                Ref: {branch.reference_no} · {locations.length} locations · {totalSKUs} SKUs · {totalItems} units
                            </p>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => openTransfer()}
                                className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100"
                            >
                                <ArrowRightLeft size={15} />
                                Transfer Stock
                            </button>
                            <button
                                onClick={() => setShowLocationForm(true)}
                                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                            >
                                <Plus size={15} />
                                New Location
                            </button>
                        </div>
                    </div>
                </div>

                {/* Summary Stats */}
                <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
                    {[
                        { icon: MapPin, label: 'Locations', value: locations.length, color: 'blue' },
                        {
                            icon: Package,
                            label: 'Active',
                            value: locations.filter((l) => l.is_active).length,
                            color: 'emerald',
                        },
                        { icon: Box, label: 'Total SKUs', value: totalSKUs, color: 'amber' },
                        { icon: Warehouse, label: 'Total Units', value: totalItems, color: 'violet' },
                    ].map(({ icon: Icon, label, value, color }) => (
                        <div
                            key={label}
                            className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-4 shadow-sm"
                        >
                            <div
                                className={`flex h-10 w-10 items-center justify-center rounded-lg bg-${color}-50`}
                            >
                                <Icon size={18} className={`text-${color}-500`} />
                            </div>
                            <div>
                                <p className="font-mono text-lg font-bold text-slate-800">{value}</p>
                                <p className="text-[11px] text-slate-400">{label}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Search + View Toggle */}
                <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="relative max-w-sm flex-1">
                        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search locations..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                    </div>

                    <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
                        <button
                            onClick={() => setViewMode('rack')}
                            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                                viewMode === 'rack'
                                    ? 'bg-blue-600 text-white'
                                    : 'text-slate-500 hover:bg-slate-50'
                            }`}
                        >
                            <Warehouse size={13} />
                            Rack View
                        </button>
                        <button
                            onClick={() => setViewMode('floorplan')}
                            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                                viewMode === 'floorplan'
                                    ? 'bg-blue-600 text-white'
                                    : 'text-slate-500 hover:bg-slate-50'
                            }`}
                        >
                            <LayoutGrid size={13} />
                            Floor Plan
                        </button>
                    </div>
                </div>

                {/* Content */}
                {filteredLocations.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center">
                        <Warehouse className="mx-auto h-10 w-10 text-slate-300" />
                        <p className="mt-3 text-sm text-slate-400">No locations found.</p>
                        <button
                            onClick={() => setShowLocationForm(true)}
                            className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline"
                        >
                            <Plus size={14} /> Create your first location
                        </button>
                    </div>
                ) : viewMode === 'rack' ? (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {filteredLocations.map((loc, i) => (
                            <ShelfRack
                                key={loc.id}
                                location={loc}
                                items={balancesByLocation.get(loc.id) ?? []}
                                colorSet={RACK_COLORS[i % RACK_COLORS.length]}
                                index={i}
                                onEdit={() => setEditingLocation(loc)}
                                onDelete={() => onDeleteLocation(loc.id)}
                                onDragStart={handleDragStart}
                                onDrop={handleDrop}
                                onDragOver={handleDragOver}
                                onTransfer={() => openTransfer(loc.id)}
                                onViewItems={() => setViewingLocation(loc)}
                            />
                        ))}
                    </div>
                ) : (
                    <FloorPlanView
                        locations={filteredLocations}
                        balancesByLocation={balancesByLocation}
                        onSelectLocation={(loc) => setViewingLocation(loc)}
                    />
                )}

                {/* Drag hint */}
                {viewMode === 'rack' && filteredLocations.length > 1 && (
                    <p className="mt-4 text-center text-xs text-slate-400">
                        💡 Drag items between racks to transfer stock
                    </p>
                )}
            </div>
        </>
    );
}