'use client';

import AsyncSearchSelect from '@/components/ui/AsyncSearchSelect';
import {
    EditableInput,
    EditableTextarea,
    FieldLabel,
} from '@/components/ui/FieldLabel';
import { ReadonlyInput } from '@/components/ui/Readonly';
import {
    ArrowLeft,
    AlertCircle,
    Loader2,
    Settings,
    Wrench,
    DollarSign,
    ShieldCheck,
    Smartphone,
    Tag,
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
    reference_no: string;
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
            label: 'ងាយ (Easy)',
            color: 'bg-emerald-50 border-emerald-200 text-emerald-700',
            activeColor: 'bg-emerald-500 border-emerald-500 text-white shadow-sm',
        },
        {
            value: 'normal',
            label: 'មធ្យម (Normal)',
            color: 'bg-blue-50 border-blue-200 text-blue-700',
            activeColor: 'bg-blue-500 border-blue-500 text-white shadow-sm',
        },
        {
            value: 'hard',
            label: 'ពិបាក (Hard)',
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
export default function NoneStockCreateForm() {
    const router = useRouter();

    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    // Lookups
    const [devices, setDevices] = useState<ServiceDevice[]>([]);
    const [categories, setCategories] = useState<ServiceCategory[]>([]);
    const [loadingLookups, setLoadingLookups] = useState(true);

    // Form state
    const [form, setForm] = useState({
        name: '',
        device_id: null as number | null,
        category_id: null as number | null,
        labor_cost: 0,
        parts_cost: 0,
        sale_price: 0,
        warranty_duration: '',
        has_warranty: false,
        difficulty: 'normal',
        description: '',
    });

    // Load devices & categories
    useEffect(() => {
        let cancelled = false;

        Promise.all([
            fetch('/api/service-device').then((r) => r.json()),
            fetch('/api/service-category').then((r) => r.json()),
        ])
            .then(([devJson, catJson]) => {
                if (cancelled) return;
                setDevices(devJson.data ?? []);
                setCategories(catJson.data ?? []);
            })
            .catch(() => {})
            .finally(() => {
                if (!cancelled) setLoadingLookups(false);
            });

        return () => {
            cancelled = true;
        };
    }, []);

    // Group devices by brand
    const devicesByBrand = devices.reduce<Record<string, ServiceDevice[]>>(
        (acc, d) => {
            const brand = d.brand || 'Other';
            if (!acc[brand]) acc[brand] = [];
            acc[brand].push(d);
            return acc;
        },
        {},
    );

    // Top-level & sub categories
    const topCategories = categories.filter((c) => !c.parent_id);
    const getSubCategories = (parentId: number) =>
        categories.filter((c) => c.parent_id === parentId);

    // Profit calculation
    const totalCost = Number(form.labor_cost) + Number(form.parts_cost);
    const profit = Number(form.sale_price) - totalCost;

    const selectedDevice = devices.find((d) => d.id === form.device_id);
    const selectedCategory = categories.find((c) => c.id === form.category_id);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!form.name.trim()) {
            setError('សូមបញ្ចូលឈ្មោះសេវាកម្ម។');
            return;
        }

        setIsSaving(true);

        try {
            const payload = {
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
            };

            const response = await fetch('/api/repair-service', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(
                    errorData.message ??
                        errorData.error ??
                        'បរាជ័យក្នុងការ​បង្កើតសេវាកម្ម។',
                );
            }

            const data = await response.json();
            router.push(`/inventory/none_stock?create_success=true`);
            router.refresh();
        } catch (error: unknown) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'មានបញ្ហាក្នុងការរក្សាទុកទិន្នន័យ!';
            setError(message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
            {/* Header */}
            <div>
                <Link
                    href="/inventory/none_stock"
                    className="inline-flex items-center gap-2 text-sm text-slate-500 transition-colors hover:text-slate-700"
                >
                    <ArrowLeft size={16} />
                    ត្រឡប់ទៅសេវាកម្ម
                </Link>
                <h2 className="mt-3 flex items-center gap-2 text-2xl font-bold text-slate-800 md:text-3xl">
                    <Wrench className="text-[#1a9e52]" />
                    បង្កើតសេវាកម្មជួសជុលថ្មី
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                    បំពេញព័ត៌មានសេវាកម្មជួសជុល ឧបករណ៍ តម្លៃពលកម្ម និងការធានា។
                </p>
            </div>

            {/* Error banner */}
            {error && (
                <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                    <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-500" />
                    <p className="text-sm text-red-700">{error}</p>
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
                onSubmit={handleSave}
                className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]"
            >
                {/* ══════════════════════════════════════════════════════════
                    LEFT COLUMN
                   ══════════════════════════════════════════════════════════ */}
                <div className="space-y-6">
                    {/* ── Section 1: Service Info ── */}
                    <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                        <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-500">
                            <Wrench size={15} className="text-[#1a9e52]" />
                            ព័ត៌មានសេវាកម្ម
                        </h3>

                        <div className="grid gap-4 lg:grid-cols-2">
                            {/* Reference No */}
                            <div>
                                <FieldLabel>Reference No</FieldLabel>
                                <ReadonlyInput placeholder="Auto-generated" />
                            </div>

                            {/* Service Name */}
                            <div>
                                <FieldLabel required>ឈ្មោះសេវាកម្ម</FieldLabel>
                                <EditableInput
                                    type="text"
                                    value={form.name}
                                    onChange={(e) =>
                                        setForm({ ...form, name: e.target.value })
                                    }
                                    placeholder="ឧ. ប្តូរអេក្រង់, ប្តូរ Battery..."
                                    required
                                />
                            </div>

                            {/* Device */}
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
                                    disabled={loadingLookups}
                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50"
                                >
                                    <option value="">
                                        {loadingLookups
                                            ? 'កំពុងទាញយក...'
                                            : 'ជ្រើសរើសឧបករណ៍...'}
                                    </option>
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

                            {/* Category */}
                            <div>
                                <FieldLabel>ប្រភេទសេវាកម្ម (Category)</FieldLabel>
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
                                    disabled={loadingLookups}
                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50"
                                >
                                    <option value="">ជ្រើសរើសប្រភេទ...</option>
                                    {topCategories.map((cat) => {
                                        const subs = getSubCategories(cat.id);
                                        if (subs.length > 0) {
                                            return (
                                                <optgroup
                                                    key={cat.id}
                                                    label={cat.name}
                                                >
                                                    <option value={cat.id}>
                                                        {cat.name} (All)
                                                    </option>
                                                    {subs.map((sub) => (
                                                        <option
                                                            key={sub.id}
                                                            value={sub.id}
                                                        >
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

                            {/* Difficulty */}
                            <div className="lg:col-span-2">
                                <FieldLabel>កម្រិតការជួសជុល (Difficulty)</FieldLabel>
                                <DifficultySelector
                                    value={form.difficulty}
                                    onChange={(val) =>
                                        setForm({ ...form, difficulty: val })
                                    }
                                />
                            </div>
                        </div>
                    </section>

                    {/* ── Section 2: Pricing ── */}
                    <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                        <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-500">
                            <DollarSign size={15} className="text-[#1a9e52]" />
                            តម្លៃ
                        </h3>

                        <div className="grid gap-4 sm:grid-cols-3">
                            <div>
                                <FieldLabel>ថ្លៃពលកម្ម (Labor Cost)</FieldLabel>
                                <EditableInput
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={form.labor_cost}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            labor_cost: Number(e.target.value),
                                        })
                                    }
                                    placeholder="0.00"
                                />
                            </div>
                            <div>
                                <FieldLabel>ថ្លៃគ្រឿងផ្គួប (Parts Cost)</FieldLabel>
                                <EditableInput
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={form.parts_cost}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            parts_cost: Number(e.target.value),
                                        })
                                    }
                                    placeholder="0.00"
                                />
                                <p className="mt-1 text-[10px] text-slate-400">
                                    ថ្លៃអេក្រង់, battery ផ្សេងៗ
                                </p>
                            </div>
                            <div>
                                <FieldLabel required>តម្លៃលក់ (Sale Price)</FieldLabel>
                                <EditableInput
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={form.sale_price}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            sale_price: Number(e.target.value),
                                        })
                                    }
                                    placeholder="0.00"
                                    required
                                />
                            </div>
                        </div>

                        {/* Profit indicator */}
                        <div className="mt-4">
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
                                <span className="text-xs font-normal opacity-70">
                                    (Labor ${Number(form.labor_cost).toFixed(2)} + Parts $
                                    {Number(form.parts_cost).toFixed(2)} = Cost $
                                    {totalCost.toFixed(2)})
                                </span>
                            </div>
                        </div>
                    </section>

                    {/* ── Section 3: Warranty ── */}
                    <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                        <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-500">
                            <ShieldCheck size={15} className="text-[#1a9e52]" />
                            ការធានា
                        </h3>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <label
                                className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-all ${
                                    form.has_warranty
                                        ? 'border-blue-200 bg-blue-50/60 shadow-sm'
                                        : 'border-slate-100 bg-white hover:border-slate-200'
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
                                    className={`flex h-5 w-5 items-center justify-center rounded-md border-2 transition-all ${
                                        form.has_warranty
                                            ? 'border-blue-500 bg-blue-500 text-white'
                                            : 'border-slate-300 bg-white'
                                    }`}
                                >
                                    {form.has_warranty && (
                                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                            <path
                                                d="M2.5 6L5 8.5L9.5 3.5"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            />
                                        </svg>
                                    )}
                                </div>
                                <div>
                                    <span className={`text-sm font-semibold ${form.has_warranty ? 'text-blue-800' : 'text-slate-700'}`}>
                                        មានការធានា
                                    </span>
                                    <p className="text-xs text-slate-400">
                                        សេវាកម្មនេះមានធានាអោយអតិថិជន
                                    </p>
                                </div>
                            </label>

                            <div>
                                <FieldLabel>រយៈពេលធានា</FieldLabel>
                                <EditableInput
                                    type="text"
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

                    {/* ── Section 4: Notes ── */}
                    <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                        <FieldLabel>កំណត់ចំណាំ (Notes)</FieldLabel>
                        <EditableTextarea
                            value={form.description}
                            onChange={(e) =>
                                setForm({ ...form, description: e.target.value })
                            }
                            placeholder="ព័ត៌មានបន្ថែមអំពីសេវាកម្មនេះ... ឧ. ត្រូវការគ្រឿងផ្គួបពី supplier X"
                            rows={3}
                        />
                    </section>
                </div>

                {/* ══════════════════════════════════════════════════════════
                    RIGHT SIDEBAR
                   ══════════════════════════════════════════════════════════ */}
                <aside className="space-y-5">
                    {/* Summary */}
                    <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                        <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
                            សង្ខេប
                        </h3>
                        <div className="space-y-1.5 text-xs text-slate-600">
                            {[
                                {
                                    label: 'Device',
                                    value: selectedDevice?.name,
                                },
                                {
                                    label: 'Category',
                                    value: selectedCategory?.name,
                                },
                                {
                                    label: 'Difficulty',
                                    value:
                                        form.difficulty === 'easy'
                                            ? 'ងាយ'
                                            : form.difficulty === 'hard'
                                              ? 'ពិបាក'
                                              : 'មធ្យម',
                                },
                                {
                                    label: 'Labor',
                                    value: `$${Number(form.labor_cost).toFixed(2)}`,
                                },
                                {
                                    label: 'Parts',
                                    value: `$${Number(form.parts_cost).toFixed(2)}`,
                                },
                                {
                                    label: 'Sale Price',
                                    value: `$${Number(form.sale_price).toFixed(2)}`,
                                },
                                {
                                    label: 'Profit',
                                    value: `$${profit.toFixed(2)}`,
                                },
                                {
                                    label: 'Warranty',
                                    value: form.has_warranty
                                        ? form.warranty_duration || 'Yes'
                                        : 'No',
                                },
                            ].map((row) => (
                                <div
                                    key={row.label}
                                    className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2"
                                >
                                    <span className="text-slate-500">
                                        {row.label}
                                    </span>
                                    <span className="truncate font-semibold text-slate-800">
                                        {row.value || '-'}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {/* Buttons */}
                        <div className="mt-5 flex flex-col-reverse gap-2">
                            <Link
                                href="/inventory/none_stock"
                                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-center text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
                            >
                                បោះបង់
                            </Link>
                            <button
                                type="submit"
                                disabled={isSaving}
                                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1a9e52] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#158042] disabled:opacity-50"
                            >
                                {isSaving && (
                                    <Loader2 size={16} className="animate-spin" />
                                )}
                                {isSaving ? 'កំពុងរក្សាទុក...' : 'រក្សាទុក'}
                            </button>
                        </div>
                    </section>
                </aside>
            </form>
        </div>
    );
}