'use client';

import { EditableInput, FieldLabel } from '@/components/ui/FieldLabel';
import { StockLocationProps } from '@/types/branch';
import { ArrowRightLeft, Loader2, Package, Search, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface BalanceItem {
    id: number;
    quantity: number;
    item_id: number;
    location_id: number;
    inventory_item: {
        id: number;
        name: string;
        sku: string | null;
        reference_no: string;
    };
}

interface Props {
    branchId: number;
    locations: StockLocationProps[];
    preselectedFromId?: number | null;
    preselectedItemId?: number | null;
    onClose: () => void;
    onSuccess?: () => void;
}

export default function StockTransferModal({
    branchId,
    locations,
    preselectedFromId,
    preselectedItemId,
    onClose,
    onSuccess,
}: Props) {
    const router = useRouter();
    const activeLocations = locations.filter((l) => l.is_active);

    const [fromLocationId, setFromLocationId] = useState<number | ''>(preselectedFromId ?? '');
    const [toLocationId, setToLocationId] = useState<number | ''>('');
    const [itemId, setItemId] = useState<number | ''>(preselectedItemId ?? '');
    const [quantity, setQuantity] = useState('');
    const [reason, setReason] = useState('');
    const [items, setItems] = useState<BalanceItem[]>([]);
    const [loadingItems, setLoadingItems] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [searchItem, setSearchItem] = useState('');

    // Load items when source location changes
    useEffect(() => {
        if (!fromLocationId) {
            setItems([]);
            return;
        }
        setLoadingItems(true);
        fetch(`/api/stock-balance?location_id=${fromLocationId}`)
            .then((r) => r.json())
            .then((data) => {
                setItems(Array.isArray(data) ? data : []);
                setLoadingItems(false);
            })
            .catch(() => setLoadingItems(false));
    }, [fromLocationId]);

    const selectedItem = items.find((i) => i.item_id === itemId);

    const filteredItems = items.filter(
        (i) =>
            i.inventory_item.name.toLowerCase().includes(searchItem.toLowerCase()) ||
            (i.inventory_item.sku ?? '').toLowerCase().includes(searchItem.toLowerCase()),
    );

    const handleSubmit = async () => {
        setError('');
        if (!fromLocationId || !toLocationId || !itemId || !quantity) {
            return setError('សូមបំពេញព័ត៌មានទាំងអស់។');
        }
        if (fromLocationId === toLocationId) {
            return setError('ទីតាំងប្រភព និងទីតាំងគោលដៅត្រូវតែខុសគ្នា។');
        }
        const qty = Number(quantity);
        if (qty <= 0) return setError('ចំនួនត្រូវតែធំជាង 0។');
        if (selectedItem && qty > selectedItem.quantity) {
            return setError(`ស្តុកមិនគ្រប់គ្រាន់។ មាន: ${selectedItem.quantity}`);
        }

        setSubmitting(true);
        try {
            const res = await fetch('/api/stock-transfer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    item_id: itemId,
                    from_location_id: fromLocationId,
                    to_location_id: toLocationId,
                    quantity: qty,
                    reason: reason || undefined,
                }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error ?? 'Transfer failed');
            router.refresh();
            onSuccess?.();
            onClose();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl animate-in slide-in-from-bottom-4 fade-in duration-300">
                <button
                    type="button"
                    onClick={onClose}
                    className="absolute right-4 top-4 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                    <X size={18} />
                </button>

                {/* Header */}
                <div className="border-b border-slate-100 px-6 py-5">
                    <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-800">
                        <ArrowRightLeft size={20} className="text-blue-600" />
                        Stock Transfer
                    </h2>
                    <p className="mt-0.5 text-sm text-slate-500">
                        ផ្ទេរស្តុកពីទីតាំងមួយទៅទីតាំងមួយទៀតក្នុងសាខា
                    </p>
                </div>

                <div className="space-y-4 px-6 py-5">
                    {/* From → To Locations */}
                    <div className="grid grid-cols-[1fr,auto,1fr] items-end gap-3">
                        <div>
                            <FieldLabel>From Location *</FieldLabel>
                            <select
                                value={fromLocationId}
                                onChange={(e) => {
                                    setFromLocationId(Number(e.target.value) || '');
                                    setItemId('');
                                }}
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                            >
                                <option value="">ជ្រើសរើស...</option>
                                {activeLocations.map((l) => (
                                    <option key={l.id} value={l.id}>
                                        {l.code ? `[${l.code}] ` : ''}
                                        {l.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-500">
                            <ArrowRightLeft size={16} />
                        </div>

                        <div>
                            <FieldLabel>To Location *</FieldLabel>
                            <select
                                value={toLocationId}
                                onChange={(e) => setToLocationId(Number(e.target.value) || '')}
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                            >
                                <option value="">ជ្រើសរើស...</option>
                                {activeLocations
                                    .filter((l) => l.id !== fromLocationId)
                                    .map((l) => (
                                        <option key={l.id} value={l.id}>
                                            {l.code ? `[${l.code}] ` : ''}
                                            {l.name}
                                        </option>
                                    ))}
                            </select>
                        </div>
                    </div>

                    {/* Item picker */}
                    <div>
                        <FieldLabel>Item *</FieldLabel>
                        {!fromLocationId ? (
                            <p className="rounded-xl border border-dashed border-slate-200 px-4 py-3 text-center text-xs text-slate-400">
                                សូមជ្រើសរើស From Location ជាមុនសិន
                            </p>
                        ) : loadingItems ? (
                            <div className="flex items-center justify-center gap-2 py-3 text-sm text-slate-400">
                                <Loader2 size={14} className="animate-spin" /> Loading items...
                            </div>
                        ) : items.length === 0 ? (
                            <p className="rounded-xl border border-dashed border-slate-200 px-4 py-3 text-center text-xs text-slate-400">
                                គ្មានស្តុកក្នុងទីតាំងនេះ
                            </p>
                        ) : (
                            <>
                                <div className="relative mb-2">
                                    <Search
                                        size={14}
                                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                                    />
                                    <input
                                        type="text"
                                        placeholder="Search items..."
                                        value={searchItem}
                                        onChange={(e) => setSearchItem(e.target.value)}
                                        className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-xs outline-none focus:border-blue-400"
                                    />
                                </div>
                                <div className="max-h-36 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2">
                                    {filteredItems.map((b) => (
                                        <button
                                            key={b.item_id}
                                            type="button"
                                            onClick={() => setItemId(b.item_id)}
                                            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                                                itemId === b.item_id
                                                    ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200'
                                                    : 'text-slate-700 hover:bg-slate-50'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                <Package size={14} className="shrink-0 text-slate-400" />
                                                <span className="truncate font-medium">
                                                    {b.inventory_item.name}
                                                </span>
                                                {b.inventory_item.sku && (
                                                    <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                                                        {b.inventory_item.sku}
                                                    </span>
                                                )}
                                            </div>
                                            <span className="ml-2 shrink-0 text-xs font-semibold text-slate-500">
                                                qty: {b.quantity}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Quantity & Reason */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <FieldLabel>Quantity *</FieldLabel>
                            <EditableInput
                                type="number"
                                min={1}
                                max={selectedItem?.quantity ?? 999999}
                                value={quantity}
                                onChange={(e) => setQuantity(e.target.value)}
                                placeholder="0"
                            />
                            {selectedItem && (
                                <p className="mt-1 text-[11px] text-slate-400">
                                    Available: {selectedItem.quantity}
                                </p>
                            )}
                        </div>
                        <div>
                            <FieldLabel>Reason</FieldLabel>
                            <EditableInput
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                placeholder="e.g. Restock display"
                            />
                        </div>
                    </div>

                    {error && (
                        <p className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</p>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                        className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                        {submitting && <Loader2 size={15} className="animate-spin" />}
                        {submitting ? 'Transferring...' : 'Transfer Stock'}
                    </button>
                </div>
            </div>
        </div>
    );
}