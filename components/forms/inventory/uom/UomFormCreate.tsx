'use client';
import { LayoutList, Loader2, Package, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import React, { useState } from 'react';
type FormState = {
    name: string | null;
};
function UomFormCreate() {
    const router = useRouter();

    const [form, setForm] = useState<FormState>({
        name: '',
    });
    const [errors, setErrors] = useState<Partial<FormState>>({});
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState<{
        msg: string;
        type: 'success' | 'error';
    } | null>(null);

    // ── Helpers ───────────────────────────────────────────────────────────────
    function showToast(msg: string, type: 'success' | 'error') {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    }

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
        // Clear field error on change
        if (errors[name as keyof FormState]) {
            setErrors((prev) => ({ ...prev, [name]: undefined }));
        }
    }

    // ── Submit ────────────────────────────────────────────────────────────────
    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        setSaving(true);
        try {
            const res = await fetch(`/api/uom`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: form.name?.trim(),
                }),
            });

            const json = await res.json();
            if (!res.ok)
                throw new Error(
                    typeof json.error === 'string'
                        ? json.error
                        : 'Failed to update category',
                );

            showToast('create successfully', 'success');

            // Navigate back to list after a short delay so the user sees the toast
            setTimeout(
                () => router.push('/inventory/configurations/uom'),
                1200,
            );
        } catch (err) {
            showToast(
                err instanceof Error ? err.message : 'Something went wrong',
                'error',
            );
        } finally {
            setSaving(false);
        }
    }

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <>
            {/* Toast */}
            {toast && (
                <div
                    className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-lg transition-all
                        ${toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}
                >
                    {toast.msg}
                </div>
            )}

            <div className="max-w-xl space-y-6 animate-in fade-in duration-500">
                {/* Header */}
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Package className="text-emerald-600" />
                        Create UOM
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">
                        កែប្រែប្រភេទទំនិញ
                    </p>
                </div>

                {/* Form */}
                <form
                    onSubmit={handleSubmit}
                    className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5"
                >
                    {/* Name */}
                    <div className="space-y-1.5">
                        <label
                            htmlFor="name"
                            className="block text-sm font-medium text-slate-700"
                        >
                            Name <span className="text-rose-500">*</span>
                        </label>
                        <input
                            id="name"
                            name="name"
                            type="text"
                            value={form.name as string}
                            onChange={handleChange}
                            placeholder="e.g. Electronics"
                            className={`block w-full px-3.5 py-2.5 rounded-xl border text-sm transition-all
                                focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500
                                ${
                                    errors.name
                                        ? 'border-rose-300 bg-rose-50'
                                        : 'border-slate-200 bg-slate-50 focus:bg-white'
                                }`}
                        />
                        {errors.name && (
                            <p className="text-xs text-rose-500">
                                {errors.name}
                            </p>
                        )}
                    </div>

                    {/* Reference No */}
                    <div className="space-y-1.5">
                        <label
                            htmlFor="reference_no"
                            className="block text-sm font-medium text-slate-700"
                        >
                            Reference No{' '}
                            <span className="text-slate-400 font-normal">
                                (optional)
                            </span>
                        </label>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3 pt-2">
                        <button
                            type="submit"
                            disabled={saving}
                            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-medium shadow-sm transition-colors"
                        >
                            {saving ? (
                                <Loader2 size={15} className="animate-spin" />
                            ) : (
                                <Save size={15} />
                            )}
                            {saving ? 'Saving...' : 'Save Changes'}
                        </button>

                        <button
                            type="button"
                            onClick={() =>
                                router.push('/inventory/configurations/uom')
                            }
                            className="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </>
    );
}

export default UomFormCreate;
