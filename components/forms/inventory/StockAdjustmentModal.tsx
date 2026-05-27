'use client';
import { EditableInput, FieldLabel } from '@/components/ui/FieldLabel';
import { StockLocationProps } from '@/types/branch';
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

export interface StockAdjustmentData {
    quantity: number;
    reason: string;
    location_id: number;
}

interface StockAdjustmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: StockAdjustmentData) => void | Promise<void>;
    isLoading?: boolean;
    locations?: StockLocationProps[];
}

const DEFAULT_REASON = 'Opening Warehouse Inventory Balance Setup';

export default function StockAdjustmentModal({
    isOpen,
    onClose,
    onSubmit,
    isLoading = false,
    locations = [],
}: StockAdjustmentModalProps) {
    const [formData, setFormData] = useState<StockAdjustmentData>({
        quantity: 1,
        reason: DEFAULT_REASON,
        location_id: 0,
    });
    const [errors, setErrors] = useState<
        Partial<Record<keyof StockAdjustmentData, string>>
    >({});

    const defaultLocation =
        locations.find((location) => location.is_default) ?? locations[0];
    const selectedLocationId = formData.location_id || defaultLocation?.id || 0;

    // ── Close on Escape ──────────────────────────────────────────────
    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isOpen, onClose]);

    const validateForm = () => {
        const newErrors: typeof errors = {};
        if (formData.quantity < 1)
            newErrors.quantity = 'Quantity must be at least 1';
        if (!formData.reason)
            newErrors.reason = 'Please select an adjustment reason';
        if (!selectedLocationId)
            newErrors.location_id = 'Please select a storage location';
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = (
        e?: React.FormEvent<HTMLFormElement> | React.MouseEvent<HTMLButtonElement>,
    ) => {
        e?.preventDefault();
        if (validateForm()) {
            onSubmit({ ...formData, location_id: selectedLocationId });
            setFormData((prev) => ({
                ...prev,
                quantity: 1,
                reason: DEFAULT_REASON,
            }));
            setErrors({});
        }
    };

    if (!isOpen) return null;

    const reasonOptions = [
        {
            value: DEFAULT_REASON,
            label: 'Opening Warehouse Inventory Balance Setup',
        },
        { value: 'Cycle Count Correction', label: 'Cycle Count Correction' },
        {
            value: 'Direct Manual Vendor Arrival',
            label: 'Direct Manual Vendor Arrival',
        },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* ── Backdrop ── */}
            <div
                onClick={onClose}
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />

            {/* ── Modal panel ── */}
            <div
                className="relative w-full max-w-md overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">
                            Log Inventory Adjustment
                        </h2>
                        <p className="text-xs text-gray-600 mt-1">
                            This action initiates a formal stock entry ledger
                            transaction trail.
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors rounded-md p-1 hover:bg-gray-100"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="px-6 py-6 space-y-5">
                    {/* Quantity */}
                    <div>
                        <FieldLabel>Received Quantity *</FieldLabel>
                        <EditableInput
                            type="number"
                            min="1"
                            value={formData.quantity}
                            onChange={(e) =>
                                setFormData((prev) => ({
                                    ...prev,
                                    quantity: parseInt(e.target.value) || 1,
                                }))
                            }
                        />
                        {errors.quantity && (
                            <p className="text-xs text-red-600 mt-1">
                                {errors.quantity}
                            </p>
                        )}
                    </div>

                    {/* Location */}
                    <div>
                        <FieldLabel>Storage Location *</FieldLabel>
                        <select
                            value={selectedLocationId || ''}
                            onChange={(e) =>
                                setFormData((prev) => ({
                                    ...prev,
                                    location_id: Number(e.target.value) || 0,
                                }))
                            }
                            disabled={locations.length === 0}
                            className={`w-full rounded-xl border bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50 ${
                                errors.location_id
                                    ? 'border-red-300 bg-red-50'
                                    : 'border-slate-200'
                            }`}
                        >
                            <option value="">ជ្រើសរើសទីតាំង...</option>
                            {locations.map((location) => (
                                <option key={location.id} value={location.id}>
                                    {location.code ? `[${location.code}] ` : ''}
                                    {location.name}
                                    {location.is_default ? ' (Default)' : ''}
                                </option>
                            ))}
                        </select>
                        {locations.length === 0 && (
                            <p className="mt-2 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                                មិនមានទីតាំងស្តុក។ សូមបង្កើត Storage Location ជាមុនសិន
                            </p>
                        )}
                        {errors.location_id && (
                            <p className="text-xs text-red-600 mt-1">
                                {errors.location_id}
                            </p>
                        )}
                    </div>

                    {/* Reason */}
                    <div>
                        <FieldLabel>Adjustment Action Reason *</FieldLabel>
                        <select
                            value={formData.reason}
                            onChange={(e) =>
                                setFormData((prev) => ({
                                    ...prev,
                                    reason: e.target
                                        .value as StockAdjustmentData['reason'],
                                }))
                            }
                            className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors ${
                                errors.reason
                                    ? 'border-red-300 bg-red-50'
                                    : 'border-gray-200 bg-white'
                            }`}
                        >
                            <option value="">Select a reason...</option>
                            {reasonOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                        {errors.reason && (
                            <p className="text-xs text-red-600 mt-1">
                                {errors.reason}
                            </p>
                        )}
                    </div>
                </form>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isLoading}
                        className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isLoading || locations.length === 0}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    >
                        {isLoading ? 'Processing...' : 'Post Adjustment Log'}
                    </button>
                </div>
            </div>
        </div>
    );
}
