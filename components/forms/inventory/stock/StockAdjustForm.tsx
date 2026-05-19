'use client';

import { EditableInput, FieldLabel } from '@/components/ui/FieldLabel';
import { BranchProps } from '@/types/branch';
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

interface Props {
    itemId: number;
    onClose: () => void;
    onSuccess?: () => void;
}

export default function StockAdjustForm({ itemId, onClose, onSuccess }: Props) {
    const router = useRouter();
    const [branches, setBranches] = useState<BranchProps[]>([]);
    const [locationId, setLocationId] = useState<number | ''>('');
    const [quantity, setQuantity] = useState<number | ''>('');
    const [reason, setReason] = useState<AdjustmentReason>(
        'Opening Warehouse Inventory Balance Setup',
    );
    const [submitting, setSubmitting] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch('/api/branch');
                const json = await res.json();
                if (!res.ok) throw new Error(json.error ?? 'Failed to load branches');
                const data: BranchProps[] = json.data ?? [];
                setBranches(data);

                const defBranch = data.find((b) => b.is_default) ?? data[0];
                const defLoc =
                    defBranch?.stock_location?.find((l) => l.is_default) ??
                    defBranch?.stock_location?.[0];
                if (defLoc) setLocationId(defLoc.id);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        })();
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
            const res = await fetch(`/api/inventory/${itemId}/adjust`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    received_quantity: Number(quantity),
                    adjustment_reason: reason,
                    location_id: Number(locationId),
                }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error?.message ?? json.error ?? 'Adjustment failed');

            router.refresh();
            onSuccess?.();
            onClose();
        } catch (err: any) {
            setError(err.message ?? 'មាន​បញ្ហា​ក្នុង​ការ​រក្សា​ទុក។');
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
                            <FieldLabel>Storage Location *</FieldLabel>
                            <select
                                value={locationId}
                                onChange={(e) => setLocationId(Number(e.target.value))}
                                required
                                disabled={loading}
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50"
                            >
                                <option value="" disabled>
                                    {loading ? '— Loading… —' : '— Select location —'}
                                </option>
                                {branches.map((b) => (
                                    <optgroup key={b.id} label={b.name}>
                                        {(b.stock_location ?? []).map((loc) => (
                                            <option key={loc.id} value={loc.id}>
                                                {loc.name}
                                                {loc.is_default ? ' (default)' : ''}
                                            </option>
                                        ))}
                                    </optgroup>
                                ))}
                            </select>
                        </div>

                        <div>
                            <FieldLabel>Received Quantity *</FieldLabel>
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
                            disabled={submitting || loading}
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