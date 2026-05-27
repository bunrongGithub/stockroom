'use client';

import { EditableInput, FieldLabel } from '@/components/ui/FieldLabel';
import { StockLocationProps } from '@/types/branch';
import { Loader2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const ADJUSTMENT_REASONS = [
    'Opening Warehouse Inventory Balance Setup',
    'Stock Received from Supplier',
    'Inventory Count Correction',
    'Damaged / Expired Stock Write-Off',
    'Internal Transfer',
    'Return to Supplier',
    'Customer Return',
    'Other',
] as const;

type AdjustmentReason = (typeof ADJUSTMENT_REASONS)[number] | '';
type MovementType = 'in' | 'out' | 'adjustment';
type LocationBalance = {
    item_id: number;
    quantity: number | string;
};

interface Props {
    itemId: number;
    onClose: () => void;
    onSuccess?: () => void;
}

export default function StockAdjustForm({ itemId, onClose, onSuccess }: Props) {
    const router = useRouter();
    const [locations, setLocations] = useState<StockLocationProps[]>([]);
    const [locationId, setLocationId] = useState<number | ''>('');
    const [movementType, setMovementType] = useState<MovementType>('in');
    const [quantity, setQuantity] = useState<number | ''>('');
    const [reason, setReason] = useState<AdjustmentReason>(
        'Opening Warehouse Inventory Balance Setup',
    );
    const [submitting, setSubmitting] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                const res = await fetch('/api/stock-location');
                const json = await res.json();
                if (!res.ok) throw new Error(json.error ?? 'Failed to load locations');
                const data: StockLocationProps[] = json.data ?? [];
                if (cancelled) return;

                setLocations(data);
                const defaultLocation =
                    data.find((location) => location.is_default) ?? data[0];
                if (defaultLocation) setLocationId(defaultLocation.id);
            } catch (err) {
                if (!cancelled) {
                    setError(
                        err instanceof Error
                            ? err.message
                            : 'Failed to load locations',
                    );
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (quantity === '' || Number(quantity) <= 0) {
            return setError('សូម​បញ្ចូល​បរិមាណ​ត្រឹមត្រូវ។');
        }
        if (!locationId) return setError('សូម​ជ្រើសរើស​ទីតាំង។');
        if (!reason) return setError('សូម​ជ្រើសរើស​មូលហេតុ។');

        setSubmitting(true);
        try {
            const qty = Number(quantity);

            if (movementType === 'out') {
                const balanceRes = await fetch(
                    `/api/stock-balance?location_id=${locationId}`,
                );
                const balanceJson = await balanceRes.json();
                if (!balanceRes.ok) {
                    throw new Error(balanceJson.error ?? 'Failed to check stock balance');
                }

                const balances: LocationBalance[] = Array.isArray(balanceJson)
                    ? balanceJson
                    : [];
                const balance = balances.find(
                    (row) => Number(row.item_id) === itemId,
                );

                if (!balance || Number(balance.quantity) < qty) {
                    setError(
                        `ស្តុកមិនគ្រប់គ្រាន់ក្នុងទីតាំងនេះ។ មាន: ${balance?.quantity ?? 0}`,
                    );
                    setSubmitting(false);
                    return;
                }
            }

            const res = await fetch(`/api/inventory/${itemId}/adjust`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    received_quantity: qty,
                    adjustment_reason: reason,
                    location_id: Number(locationId),
                    movement_type: movementType,
                }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error?.message ?? json.error ?? 'Adjustment failed');

            router.refresh();
            onSuccess?.();
            onClose();
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'មាន​បញ្ហា​ក្នុង​ការ​រក្សា​ទុក។',
            );
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl">
                <button
                    type="button"
                    onClick={onClose}
                    className="absolute right-4 top-4 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    aria-label="Close"
                >
                    <X size={18} />
                </button>

                <div className="border-b border-slate-100 px-6 py-5">
                    <h2 className="text-lg font-semibold text-slate-800">Log Inventory Adjustment</h2>
                    <p className="mt-0.5 text-sm text-slate-500">
                        This action initiates a formal stock entry ledger transaction trail.
                    </p>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="space-y-5 px-6 py-6">
                        <div>
                            <FieldLabel>Movement Type *</FieldLabel>
                            <select
                                value={movementType}
                                onChange={(e) =>
                                    setMovementType(e.target.value as MovementType)
                                }
                                required
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                            >
                                <option value="in">Stock In</option>
                                <option value="out">Stock Out</option>
                                <option value="adjustment">Set Exact Quantity</option>
                            </select>
                        </div>

                        <div>
                            <FieldLabel>Storage Location *</FieldLabel>
                            <select
                                value={locationId}
                                onChange={(e) =>
                                    setLocationId(Number(e.target.value) || '')
                                }
                                required
                                disabled={loading || locations.length === 0}
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50"
                            >
                                <option value="" disabled>
                                    {loading ? '— Loading… —' : '— Select location —'}
                                </option>
                                {locations.map((location) => (
                                    <option key={location.id} value={location.id}>
                                        {location.code ? `[${location.code}] ` : ''}
                                        {location.name}
                                        {location.is_default ? ' (default)' : ''}
                                    </option>
                                ))}
                            </select>
                            {!loading && locations.length === 0 && (
                                <p className="mt-2 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                                    មិនមានទីតាំងស្តុក។ សូមបង្កើត Storage Location ជាមុនសិន
                                </p>
                            )}
                        </div>

                        <div>
                            <FieldLabel>
                                {movementType === 'adjustment'
                                    ? 'Exact Quantity *'
                                    : 'Quantity *'}
                            </FieldLabel>
                            <EditableInput
                                type="number"
                                min={1}
                                step={1}
                                placeholder="0"
                                value={quantity}
                                onChange={(e) =>
                                    setQuantity(e.target.value === '' ? '' : Number(e.target.value))
                                }
                                required
                            />
                        </div>

                        <div>
                            <FieldLabel>Adjustment Action Reason *</FieldLabel>
                            <select
                                value={reason}
                                onChange={(e) => setReason(e.target.value as AdjustmentReason)}
                                required
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                            >
                                <option value="" disabled>— ជ្រើសរើស​មូលហេតុ —</option>
                                {ADJUSTMENT_REASONS.map((r) => (
                                    <option key={r} value={r}>{r}</option>
                                ))}
                            </select>
                        </div>

                        {error && (
                            <p className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</p>
                        )}
                    </div>

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
                            type="submit"
                            disabled={submitting || loading || locations.length === 0}
                            className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                            {submitting && <Loader2 size={15} className="animate-spin" />}
                            {submitting ? 'Processing...' : 'Post Adjustment Log'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
