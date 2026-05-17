'use client';
import { useState } from 'react';
import { X } from 'lucide-react';

export interface StockAdjustmentData {
  quantity: number;
  reason: 'opening' | 'cycle_count' | 'vendor_arrival';
}

interface StockAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: StockAdjustmentData) => void;
  isLoading?: boolean;
}

export default function StockAdjustmentModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
}: StockAdjustmentModalProps) {
  const [formData, setFormData] = useState<StockAdjustmentData>({
    quantity: 1,
    reason: 'opening',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof StockAdjustmentData, string>>>({});

  const validateForm = () => {
    const newErrors: typeof errors = {};

    if (formData.quantity < 1) {
      newErrors.quantity = 'Quantity must be at least 1';
    }
    if (!formData.reason) {
      newErrors.reason = 'Please select an adjustment reason';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit(formData);
      setFormData({ quantity: 1, reason: 'opening' });
      setErrors({});
    }
  };

  if (!isOpen) return null;

  const reasonOptions = [
    {
      value: 'opening',
      label: 'Opening Warehouse Inventory Balance Setup',
    },
    {
      value: 'cycle_count',
      label: 'Cycle Count Correction',
    },
    {
      value: 'vendor_arrival',
      label: 'Direct Manual Vendor Arrival',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl border border-gray-200 shadow-xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Log Inventory Adjustment</h2>
            <p className="text-xs text-gray-600 mt-1">
              This action initiates a formal stock entry ledger transaction trail.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-6 space-y-5">
          {/* Received Quantity */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Received Quantity *
            </label>
            <input
              type="number"
              min="1"
              value={formData.quantity}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  quantity: parseInt(e.target.value) || 1,
                }))
              }
              className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors ${
                errors.quantity ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'
              }`}
            />
            {errors.quantity && (
              <p className="text-xs text-red-600 mt-1">{errors.quantity}</p>
            )}
          </div>

          {/* Adjustment Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Adjustment Action Reason *
            </label>
            <select
              value={formData.reason}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  reason: e.target.value as StockAdjustmentData['reason'],
                }))
              }
              className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors ${
                errors.reason ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'
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
              <p className="text-xs text-red-600 mt-1">{errors.reason}</p>
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
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Processing...' : 'Post Adjustment Log'}
          </button>
        </div>
      </div>
    </div>
  );
}
