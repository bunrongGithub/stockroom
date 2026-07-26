'use client';

import {
    EditableInput,
    EditableTextarea,
    FieldLabel,
} from '@/components/ui/FieldLabel';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/Toast';
import { uomApi } from '@/lib/api/uom';
import type { InventoryUom } from '@/service/apps/inventory/repo/uom';
import { AlertCircle, ArrowLeft, Loader2, Ruler, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const LIST_URL = '/inventory/configurations/uom';

export default function UomForm({
    mode,
    initial,
}: {
    mode: 'create' | 'edit';
    initial?: InventoryUom;
}) {
    const router = useRouter();
    const toast = useToast();

    const [code, setCode] = useState(initial?.code ?? '');
    const [name, setName] = useState(initial?.name ?? '');
    const [displayName, setDisplayName] = useState(initial?.display_name ?? '');
    const [description, setDescription] = useState(initial?.description ?? '');
    const [isActive, setIsActive] = useState(initial?.is_active ?? true);
    const [isDefault, setIsDefault] = useState(initial?.is_default ?? false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError('');
        if (!code.trim()) return setError('Code is required');
        if (!name.trim()) return setError('Name is required');
        if (!displayName.trim()) return setError('Symbol is required');

        setSaving(true);
        try {
            const payload = {
                code: code.trim(),
                name: name.trim(),
                display_name: displayName.trim(),
                description: description.trim() || undefined,
                is_active: isActive,
                is_default: isDefault,
            };
            const saved =
                mode === 'create'
                    ? await uomApi.create(payload)
                    : await uomApi.update(initial!.id, payload);
            toast.success(
                `Unit ${saved.code} ${mode === 'create' ? 'created' : 'updated'}.`,
            );
            router.push(`${LIST_URL}/${saved.id}/view`);
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save');
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="space-y-4 font-mono text-xs">
            <div>
                <Link
                    href={LIST_URL}
                    className="inline-flex items-center gap-2 text-slate-500 transition-colors hover:text-slate-700"
                >
                    <ArrowLeft size={16} /> Back to Unit of Measure
                </Link>
                <h2 className="mt-3 flex items-center gap-2 text-2xl font-bold text-slate-800 md:text-3xl">
                    <Ruler className="text-[#1a9e52]" />
                    {mode === 'create'
                        ? 'New Unit of Measure'
                        : `Edit ${initial?.code}`}
                </h2>
            </div>

            {error && (
                <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                    <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-500" />
                    <p className="text-red-700">{error}</p>
                    <button
                        type="button"
                        onClick={() => setError('')}
                        className="ml-auto shrink-0 text-red-400 hover:text-red-600"
                    >
                        <X size={16} />
                    </button>
                </div>
            )}

            <form
                onSubmit={handleSubmit}
                className="grid gap-6 xl:grid-cols-[350px_minmax(0,1fr)]"
            >
                {/* Sidebar */}
                <aside className="space-y-4 self-start xl:sticky xl:top-6">
                    <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
                        <div className="flex items-center gap-2 border-b border-slate-50 bg-slate-50/80 px-4 py-2.5">
                            <Ruler size={13} className="text-[#1a9e52]" />
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                Settings
                            </span>
                        </div>
                        <div className="space-y-4 p-4">
                            <label className="flex items-start gap-3">
                                <Switch
                                    checked={isActive}
                                    onCheckedChange={setIsActive}
                                />
                                <span>
                                    <span className="font-semibold text-slate-800">
                                        Active
                                    </span>
                                    <span className="mt-0.5 block text-slate-400">
                                        Inactive units can&apos;t be used on new
                                        records.
                                    </span>
                                </span>
                            </label>
                            <label className="flex items-start gap-3">
                                <Switch
                                    checked={isDefault}
                                    onCheckedChange={setIsDefault}
                                />
                                <span>
                                    <span className="font-semibold text-slate-800">
                                        Default unit
                                    </span>
                                    <span className="mt-0.5 block text-slate-400">
                                        One per company.
                                    </span>
                                </span>
                            </label>
                        </div>
                    </section>

                    <div className="flex flex-col-reverse gap-2">
                        <Link
                            href={LIST_URL}
                            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-center text-slate-600 transition-colors hover:bg-slate-50"
                        >
                            Cancel
                        </Link>
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                        >
                            {saving && (
                                <Loader2 className="animate-spin" size={16} />
                            )}
                            {saving
                                ? 'Saving...'
                                : mode === 'create'
                                  ? 'Save Unit'
                                  : 'Save Changes'}
                        </button>
                    </div>
                </aside>

                {/* Main */}
                <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                    <h3 className="mb-4 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        <Ruler size={13} className="text-[#1a9e52]" /> Unit
                        Information
                    </h3>

                    <div className="grid gap-4 lg:grid-cols-2">
                        <div>
                            <FieldLabel required>Code</FieldLabel>
                            <EditableInput
                                value={code}
                                onChange={(e) =>
                                    setCode(e.target.value.toUpperCase())
                                }
                                placeholder="e.g. PCS, KG, BOX"
                                maxLength={20}
                                autoFocus
                            />
                            <p className="mt-1 text-slate-400">
                                Unique business code (auto-uppercased).
                            </p>
                        </div>
                        <div>
                            <FieldLabel required>Symbol</FieldLabel>
                            <EditableInput
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                placeholder="e.g. pcs, kg, box"
                                maxLength={20}
                            />
                            <p className="mt-1 text-slate-400">
                                Shown on documents.
                            </p>
                        </div>
                        <div className="lg:col-span-2">
                            <FieldLabel required>Name</FieldLabel>
                            <EditableInput
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g. Pieces, Kilogram, Box"
                            />
                        </div>
                        <div className="lg:col-span-2">
                            <FieldLabel>Description</FieldLabel>
                            <EditableTextarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Optional notes about this unit"
                                rows={3}
                            />
                        </div>
                    </div>
                </section>
            </form>
        </div>
    );
}
