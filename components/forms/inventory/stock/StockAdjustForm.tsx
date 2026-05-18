'use client';

import { FieldLabel, EditableInput } from '@/components/ui/FieldLabel';
import { Loader2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

// ─── Preset reasons ───────────────────────────────────────────────────────────
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

// ─── Props ────────────────────────────────────────────────────────────────────
interface StockAdjustFormProps {
    itemId: number;          // must be a valid numeric inventory ID
    onClose: () => void;
    onSuccess?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function StockAdjustForm({
    itemId,
    onClose,
    onSuccess,
}: StockAdjustFormProps) {
    const router = useRouter();

    const [quantity, setQuantity] = useState<number | ''>('');
    const [reason, setReason] = useState<AdjustmentReason>(
        'Opening Warehouse Inventory Balance Setup',
    );
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    // ── Submit ────────────────────────────────────────────────────────────────
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (quantity === '' || Number(quantity) <= 0) {
            return setError('សូម​បញ្ចូល​បរិមាណ​ត្រឹមត្រូវ។');
        }
        if (!reason) {
            return setError('សូម​ជ្រើសរើស​មូលហេតុ​នៃ​ការ​កែសម្រួល។');
        }

        setIsSubmitting(true);
        try {
            // POST to the correct adjust endpoint
            const res = await fetch(`/api/inventory/${itemId}/adjust`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    received_quantity: Number(quantity),
                    adjustment_reason: reason,
                }),
            });

            if (!res.ok) {
                const json = await res.json().catch(() => ({}));
                throw new Error(json.message ?? json.error ?? 'Adjustment failed.');
            }

            router.refresh();
            onSuccess?.();
            onClose();
        } catch (err: unknown) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'មាន​បញ្ហា​ក្នុង​ការ​រក្សាទុក​ទិន្នន័យ។',
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        /* Backdrop — click outside to close */
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            {/* Modal card */}
            <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl">

                {/* ✕ Close */}
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="absolute right-4 top-4 rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                >
                    <X size={18} />
                </button>

                {/* ── Header ── */}
                <div className="border-b border-slate-100 px-6 py-5">
                    <h2 className="text-lg font-semibold text-slate-800">
                        Log Inventory Adjustment
                    </h2>
                    <p className="mt-0.5 text-sm text-slate-500">
                        This action initiates a formal stock entry ledger
                        transaction trail.
                    </p>
                </div>

                {/* ── Body ── */}
                <form onSubmit={handleSubmit}>
                    <div className="space-y-5 px-6 py-6">

                        {/* Received Quantity */}
                        <div>
                            <FieldLabel>Received Quantity *</FieldLabel>
                            <EditableInput
                                type="number"
                                name="received_quantity"
                                min={1}
                                step={1}
                                placeholder="0"
                                value={quantity}
                                onChange={(e) =>
                                    setQuantity(
                                        e.target.value === ''
                                            ? ''
                                            : Number(e.target.value),
                                    )
                                }
                                required
                            />
                        </div>

                        {/* Adjustment Action Reason */}
                        <div>
                            <FieldLabel>Adjustment Action Reason *</FieldLabel>
                            <select
                                value={reason}
                                onChange={(e) =>
                                    setReason(e.target.value as AdjustmentReason)
                                }
                                required
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                            >
                                <option value="" disabled>
                                    — ជ្រើសរើស​មូលហេតុ —
                                </option>
                                {ADJUSTMENT_REASONS.map((r) => (
                                    <option key={r} value={r}>
                                        {r}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Error */}
                        {error && (
                            <p className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-600">
                                {error}
                            </p>
                        )}
                    </div>

                    {/* ── Footer ── */}
                    <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                        >
                            {isSubmitting && (
                                <Loader2 size={15} className="animate-spin" />
                            )}
                            {isSubmitting ? 'Processing...' : 'Post Adjustment Log'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}