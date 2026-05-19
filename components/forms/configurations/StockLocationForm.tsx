'use client';

import { EditableInput, FieldLabel } from '@/components/ui/FieldLabel';
import { StockLocationProps } from '@/types/branch';
import { Loader2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface Props {
    branchId: number;
    location?: StockLocationProps | null;
    onClose: () => void;
    onSuccess?: () => void;
}

export default function StockLocationForm({ branchId, location, onClose, onSuccess }: Props) {
    const router = useRouter();
    const isEdit = !!location;

    const [form, setForm] = useState({
        name: location?.name ?? '',
        code: location?.code ?? '',
        description: location?.description ?? '',
        is_default: location?.is_default ?? false,
        is_active: location?.is_active ?? true,
    });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!form.name.trim()) return setError('សូម​បញ្ចូល​ឈ្មោះ​ទីតាំង។');

        setSubmitting(true);
        try {
            const url = isEdit ? `/api/stock-location/${location.id}` : '/api/stock-location';
            const method = isEdit ? 'PATCH' : 'POST';
            const body = isEdit ? form : { ...form, branch_id: branchId };
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error?.message ?? json.error ?? 'Save failed');

            router.refresh();
            onSuccess?.();
            onClose();
        } catch (err: any) {
            setError(err.message ?? 'មាន​បញ្ហា​ក្នុង​ការ​រក្សាទុក។');
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
                >
                    <X size={18} />
                </button>

                <div className="border-b border-slate-100 px-6 py-5">
                    <h2 className="text-lg font-semibold text-slate-800">
                        {isEdit ? 'Edit Storage Location' : 'Create Storage Location'}
                    </h2>
                    <p className="mt-0.5 text-sm text-slate-500">
                        ទីតាំង​ផ្ទាល់​ខាងក្នុង​សាខា​សម្រាប់​ទុក​​ស្តុក
                    </p>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="space-y-5 px-6 py-6">
                        <div>
                            <FieldLabel>Location Name *</FieldLabel>
                            <EditableInput
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                placeholder="e.g. Display Counter 1, Backroom Drawer A"
                                required
                            />
                        </div>

                        <div>
                            <FieldLabel>Code</FieldLabel>
                            <EditableInput
                                value={form.code}
                                onChange={(e) => setForm({ ...form, code: e.target.value })}
                                placeholder="e.g. DC1, BRA"
                            />
                        </div>

                        <div>
                            <FieldLabel>Description</FieldLabel>
                            <textarea
                                value={form.description}
                                onChange={(e) => setForm({ ...form, description: e.target.value })}
                                rows={2}
                                placeholder="Optional notes about this location"
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                            />
                        </div>

                        <div className="flex items-center gap-6">
                            <label className="flex items-center gap-2 text-sm text-slate-700">
                                <input
                                    type="checkbox"
                                    checked={form.is_default}
                                    onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
                                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                />
                                Default for this branch
                            </label>
                            {isEdit && (
                                <label className="flex items-center gap-2 text-sm text-slate-700">
                                    <input
                                        type="checkbox"
                                        checked={form.is_active}
                                        onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    Active
                                </label>
                            )}
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
                            disabled={submitting}
                            className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                            {submitting && <Loader2 size={15} className="animate-spin" />}
                            {submitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Location'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}