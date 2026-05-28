'use client';

import {
    EditableInput,
    EditableTextarea,
    FieldLabel,
} from '@/components/ui/FieldLabel';
import {
    AlertCircle,
    ArrowLeft,
    DollarSign,
    Loader2,
    ShieldCheck,
    Wrench,
    X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface ServiceDevice {
    id: number;
    name: string;
    brand: string | null;
    device_type: string;
}

interface ServiceCategory {
    id: number;
    name: string;
    parent_id: number | null;
}

export interface RepairServiceUpdateData {
    id: number;
    name: string;
    reference_no: string;
    device_id: number | null;
    category_id: number | null;
    labor_cost: number;
    parts_cost: number;
    sale_price: number;
    warranty_duration: string | null;
    has_warranty: boolean;
    difficulty: string;
    description: string | null;
    is_active: boolean;
    device?: { id: number; name: string; brand: string | null } | null;
    category?: { id: number; name: string } | null;
}

interface Props {
    item: RepairServiceUpdateData;
}

// ─── Difficulty Selector ──────────────────────────────────────────────────────
function DifficultySelector({
    value,
    onChange,
}: {
    value: string;
    onChange: (val: string) => void;
}) {
    const options = [
        {
            value: 'easy',
            label: 'ងាយ',
            color: 'bg-emerald-50 border-emerald-200 text-emerald-700',
            activeColor: 'bg-emerald-500 border-emerald-500 text-white shadow-sm',
        },
        {
            value: 'normal',
            label: 'មធ្យម',
            color: 'bg-blue-50 border-blue-200 text-blue-700',
            activeColor: 'bg-blue-500 border-blue-500 text-white shadow-sm',
        },
        {
            value: 'hard',
            label: 'ពិបាក',
            color: 'bg-red-50 border-red-200 text-red-700',
            activeColor: 'bg-red-500 border-red-500 text-white shadow-sm',
        },
    ];

    return (
        <div className="flex flex-wrap gap-2">
            {options.map((opt) => (
                <button
                    key={opt.value}
                    type="button"
                    onClick={() => onChange(opt.value)}
                    className={`rounded-lg border px-3.5 py-2 text-xs font-semibold transition-all ${
                        value === opt.value ? opt.activeColor : opt.color
                    }`}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    );
}

// ─── Main Form ────────────────────────────────────────────────────────────────
export default function NoneStockUpdateForm({ item }: Props) {
    const router = useRouter();
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [toast, setToast] = useState<{
        msg: string;
        type: 'success' | 'error';
    } | null>(null);

    // Lookups
    const [devices, setDevices] = useState<ServiceDevice[]>([]);
    const [categories, setCategories] = useState<ServiceCategory[]>([]);

    const [form, setForm] = useState({
        name: item.name ?? '',
        device_id: item.device_id,
        category_id: item.category_id,
        labor_cost: item.labor_cost ?? 0,
        parts_cost: item.parts_cost ?? 0,
        sale_price: item.sale_price ?? 0,
        warranty_duration: item.warranty_duration ?? '',
        has_warranty: item.has_warranty ?? false,
        difficulty: item.difficulty ?? 'normal',
        description: item.description ?? '',
        is_active: item.is_active ?? true,
    });

    // Load lookups
    useEffect(() => {
        Promise.all([
            fetch('/api/service-device').then((r) => r.json()),
            fetch('/api/service-category').then((r) => r.json()),
        ])
            .then(([devJson, catJson]) => {
                setDevices(devJson.data ?? []);
                setCategories(catJson.data ?? []);
            })
            .catch(() => {});
    }, []);

    const devicesByBrand = devices.reduce<Record<string, ServiceDevice[]>>(
        (acc, d) => {
            const brand = d.brand || 'Other';
            if (!acc[brand]) acc[brand] = [];
            acc[brand].push(d);
            return acc;
        },
        {},
    );

    const topCategories = categories.filter((c) => !c.parent_id);
    const getSubCategories = (parentId: number) =>
        categories.filter((c) => c.parent_id === parentId);

    const totalCost = Number(form.labor_cost) + Number(form.parts_cost);
    const profit = Number(form.sale_price) - totalCost;

    const showToast = (msg: string, type: 'success' | 'error') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!form.name.trim()) {
            setError('សូមបញ្ចូលឈ្មោះសេវាកម្ម។');
            return;
        }

        setSaving(true);
        try {
            const res = await fetch(`/api/repair-service/${item.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: form.name.trim(),
                    device_id: form.device_id,
                    category_id: form.category_id,
                    labor_cost: Number(form.labor_cost),
                    parts_cost: Number(form.parts_cost),
                    sale_price: Number(form.sale_price),
                    warranty_duration: form.warranty_duration || null,
                    has_warranty: form.has_warranty,
                    difficulty: form.difficulty,
                    description: form.description || null,
                    is_active: form.is_active,
                }),
            });

            const json = await res.json();
            if (!res.ok) {
                throw new Error(
                    json.error?.message ?? json.error ?? 'Update failed',
                );
            }

            showToast('សេវាកម្មត្រូវបានធ្វើបច្ចុប្បន្នភាពដោយជោគជ័យ', 'success');
            setTimeout(() => {
                router.push(`/inventory/none_stock`);
                router.refresh();
            }, 1000);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'មានបញ្ហាក្នុងការរក្សាទុក។',
            );
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            {toast && (
                <div
                    className={`fixed right-4 top-4 z-50 rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${
                        toast.type === 'success'
                            ? 'bg-emerald-500 text-white'
                            : 'bg-rose-500 text-white'
                    }`}
                >
                    {toast.msg}
                </div>
            )}

            <div className="mx-auto max-w-3xl space-y-6 p-4 animate-in fade-in duration-500 md:p-8">
                <div>
                    <Link
                        href="/inventory/none_stock"
                        className="inline-flex items-center gap-2 text-sm text-slate-500 transition-colors hover:text-slate-700"
                    >
                        <ArrowLeft size={16} />
                        ត្រឡប់ទៅសេវាកម្ម
                    </Link>
                    <h2 className="mt-3 flex items-center gap-2 text-2xl font-bold text-slate-800">
                        <Wrench className="text-[#1a9e52]" />
                        កែប្រែសេវាកម្ម
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                        Ref: {item.reference_no || '-'}
                    </p>
                </div>

                {error && (
                    <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                        <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-500" />
                        <p className="text-sm text-red-700">{error}</p>
                        <button
                            type="button"
                            onClick={() => setError('')}
                            className="ml-auto text-red-400 hover:text-red-600"
                        >
                            <X size={16} />
                        </button>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* ── Service Info ── */}
                    <section className="space-y-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
                        <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-500">
                            <Wrench size={14} className="text-[#1a9e52]" />
                            ព័ត៌មានសេវាកម្ម
                        </h3>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="sm:col-span-2">
                                <FieldLabel required>ឈ្មោះសេវាកម្ម</FieldLabel>
                                <EditableInput
                                    value={form.name}
                                    onChange={(e) =>
                                        setForm({ ...form, name: e.target.value })
                                    }
                                    placeholder="ឧ. ប្តូរអេក្រង់ iPhone 13 Pro"
                                    required
                                />
                            </div>

                            <div>
                                <FieldLabel>ឧបករណ៍ (Device)</FieldLabel>
                                <select
                                    value={form.device_id ?? ''}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            device_id: e.target.value
                                                ? Number(e.target.value)
                                                : null,
                                        })
                                    }
                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                >
                                    <option value="">ជ្រើសរើសឧបករណ៍...</option>
                                    {Object.entries(devicesByBrand).map(
                                        ([brand, devs]) => (
                                            <optgroup key={brand} label={brand}>
                                                {devs.map((d) => (
                                                    <option key={d.id} value={d.id}>
                                                        {d.name}
                                                    </option>
                                                ))}
                                            </optgroup>
                                        ),
                                    )}
                                </select>
                            </div>

                            <div>
                                <FieldLabel>ប្រភេទ (Category)</FieldLabel>
                                <select
                                    value={form.category_id ?? ''}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            category_id: e.target.value
                                                ? Number(e.target.value)
                                                : null,
                                        })
                                    }
                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                >
                                    <option value="">ជ្រើសរើសប្រភេទ...</option>
                                    {topCategories.map((cat) => {
                                        const subs = getSubCategories(cat.id);
                                        if (subs.length > 0) {
                                            return (
                                                <optgroup key={cat.id} label={cat.name}>
                                                    <option value={cat.id}>
                                                        {cat.name} (All)
                                                    </option>
                                                    {subs.map((sub) => (
                                                        <option key={sub.id} value={sub.id}>
                                                            └ {sub.name}
                                                        </option>
                                                    ))}
                                                </optgroup>
                                            );
                                        }
                                        return (
                                            <option key={cat.id} value={cat.id}>
                                                {cat.name}
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>

                            <div className="sm:col-span-2">
                                <FieldLabel>កម្រិត (Difficulty)</FieldLabel>
                                <DifficultySelector
                                    value={form.difficulty}
                                    onChange={(val) =>
                                        setForm({ ...form, difficulty: val })
                                    }
                                />
                            </div>
                        </div>
                    </section>

                    {/* ── Pricing ── */}
                    <section className="space-y-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
                        <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-500">
                            <DollarSign size={14} className="text-[#1a9e52]" />
                            តម្លៃ
                        </h3>

                        <div className="grid gap-4 sm:grid-cols-3">
                            <div>
                                <FieldLabel>ថ្លៃពលកម្ម ($)</FieldLabel>
                                <EditableInput
                                    type="number"
                                    min={0}
                                    step={0.01}
                                    value={form.labor_cost}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            labor_cost: Number(e.target.value),
                                        })
                                    }
                                />
                            </div>
                            <div>
                                <FieldLabel>ថ្លៃគ្រឿងផ្គួប ($)</FieldLabel>
                                <EditableInput
                                    type="number"
                                    min={0}
                                    step={0.01}
                                    value={form.parts_cost}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            parts_cost: Number(e.target.value),
                                        })
                                    }
                                />
                            </div>
                            <div>
                                <FieldLabel required>តម្លៃលក់ ($)</FieldLabel>
                                <EditableInput
                                    type="number"
                                    min={0}
                                    step={0.01}
                                    value={form.sale_price}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            sale_price: Number(e.target.value),
                                        })
                                    }
                                    required
                                />
                            </div>
                        </div>

                        <div
                            className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold ${
                                profit > 0
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                    : profit < 0
                                      ? 'border-red-200 bg-red-50 text-red-600'
                                      : 'border-slate-200 bg-slate-50 text-slate-500'
                            }`}
                        >
                            <DollarSign size={14} />
                            ប្រាក់ចំណេញ: ${profit.toFixed(2)}
                        </div>
                    </section>

                    {/* ── Warranty ── */}
                    <section className="space-y-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
                        <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-500">
                            <ShieldCheck size={14} className="text-[#1a9e52]" />
                            ការធានា
                        </h3>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <label
                                className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-all ${
                                    form.has_warranty
                                        ? 'border-blue-200 bg-blue-50/60'
                                        : 'border-slate-100 hover:border-slate-200'
                                }`}
                            >
                                <input
                                    type="checkbox"
                                    checked={form.has_warranty}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            has_warranty: e.target.checked,
                                        })
                                    }
                                    className="sr-only"
                                />
                                <div
                                    className={`flex h-5 w-5 items-center justify-center rounded-md border-2 ${
                                        form.has_warranty
                                            ? 'border-blue-500 bg-blue-500 text-white'
                                            : 'border-slate-300'
                                    }`}
                                >
                                    {form.has_warranty && (
                                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                            <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    )}
                                </div>
                                <span className={`text-sm font-semibold ${form.has_warranty ? 'text-blue-800' : 'text-slate-700'}`}>
                                    មានការធានា
                                </span>
                            </label>

                            <div>
                                <FieldLabel>រយៈពេលធានា</FieldLabel>
                                <EditableInput
                                    value={form.warranty_duration}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            warranty_duration: e.target.value,
                                        })
                                    }
                                    placeholder="ឧ. 3 months, 1 year..."
                                    disabled={!form.has_warranty}
                                />
                            </div>
                        </div>
                    </section>

                    {/* ── Notes ── */}
                    <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
                        <FieldLabel>កំណត់ចំណាំ</FieldLabel>
                        <EditableTextarea
                            value={form.description}
                            onChange={(e) =>
                                setForm({ ...form, description: e.target.value })
                            }
                            placeholder="ព័ត៌មានបន្ថែម..."
                            rows={3}
                        />
                    </section>

                    {/* ── Actions ── */}
                    <div className="flex items-center gap-3">
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex items-center gap-2 rounded-xl bg-[#1a9e52] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#158042] disabled:opacity-50"
                        >
                            {saving && <Loader2 size={15} className="animate-spin" />}
                            {saving ? 'កំពុងរក្សាទុក...' : 'រក្សាទុកការផ្លាស់ប្តូរ'}
                        </button>
                        <Link
                            href="/inventory/none_stock"
                            className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                        >
                            បោះបង់
                        </Link>
                    </div>
                </form>
            </div>
        </>
    );
}