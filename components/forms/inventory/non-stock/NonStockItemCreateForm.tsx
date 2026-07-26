'use client';

import AsyncSearchSelect from '@/components/ui/AsyncSearchSelect';
import {
    EditableInput,
    EditableTextarea,
    FieldLabel,
} from '@/components/ui/FieldLabel';
import { ReadonlyInput } from '@/components/ui/Readonly';
import {
    AlertCircle,
    ArrowLeft,
    BarChart3,
    Building2,
    CalendarDays,
    ChevronRight,
    Clock,
    Loader2,
    Package,
    Percent,
    RotateCcw,
    ShieldCheck,
    Tag,
    User,
    X,
} from 'lucide-react';
import { useUserProfile } from '@/context/UserProfileContext';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

const TABS = [
    { id: 'details' as const, label: 'Details', num: 1 },
    { id: 'pricing' as const, label: 'Pricing', num: 2 },
    { id: 'options' as const, label: 'More Options', num: 3 },
];
type TabId = (typeof TABS)[number]['id'];

type FormValues = {
    name: string;
    sku: string;
    description: string;
    price: number;
    cost: number;
    min_price: number | '';
    max_price: number | '';
    category_id: number | null;
    category: { id: number | null; name: string } | null;
    uom_id: number | null;
    uom: { id: number | null; name: string } | null;
    is_discount: boolean;
    is_variant: boolean;
    is_sellable: boolean;
    is_returnable: boolean;
    is_warranty: boolean;
    warranty_duration: string;
};

function ToggleCheckbox({
    checked,
    onChange,
    icon,
    label,
    description,
}: {
    checked: boolean;
    onChange: (val: boolean) => void;
    icon: React.ReactNode;
    label: string;
    description: string;
}) {
    return (
        <label
            className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-all ${
                checked
                    ? 'border-blue-200 bg-blue-50/60 shadow-sm'
                    : 'border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50/50'
            }`}
        >
            <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
                className="sr-only"
            />
            <div
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all ${
                    checked
                        ? 'border-blue-500 bg-blue-500 text-white'
                        : 'border-slate-300 bg-white'
                }`}
            >
                {checked && (
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
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <span className={checked ? 'text-blue-600' : 'text-slate-400'}>{icon}</span>
                    <span className={`font-semibold ${checked ? 'text-blue-800' : 'text-slate-700'}`}>
                        {label}
                    </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-400">{description}</p>
            </div>
        </label>
    );
}

export default function NonStockItemCreateForm() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<TabId>('details');
    const currentUser = useUserProfile();
    const [submitError, setSubmitError] = useState('');
    const [createdAt] = useState(() => new Date());

    const {
        register,
        control,
        handleSubmit,
        watch,
        setValue,
        formState: { errors, isSubmitting },
    } = useForm<FormValues>({
        defaultValues: {
            name: '',
            sku: '',
            description: '',
            price: 0,
            cost: 0,
            min_price: '',
            max_price: '',
            category_id: null,
            category: null,
            uom_id: null,
            uom: null,
            is_discount: true,
            is_variant: false,
            is_sellable: true,
            is_returnable: false,
            is_warranty: false,
            warranty_duration: '',
        },
    });


    const price = watch('price');
    const cost = watch('cost');
    const profit = Number(price) - Number(cost);
    const profitMargin = Number(price) > 0 ? ((profit / Number(price)) * 100).toFixed(1) : '0.0';
    const isWarranty = watch('is_warranty');

    const onSubmit = async (data: FormValues) => {
        setSubmitError('');
        try {
            const payload = {
                name: data.name,
                item_class: 'non_stock',
                sku: data.sku || null,
                description: data.description || null,
                price: Number(data.price),
                cost: Number(data.cost) || null,
                min_price: data.min_price === '' ? null : Number(data.min_price),
                max_price: data.max_price === '' ? null : Number(data.max_price),
                category_id: data.category_id,
                uom_id: data.uom_id,
                is_discount: data.is_discount,
                is_variant: data.is_variant,
                is_sellable: data.is_sellable,
                is_returnable: data.is_returnable,
                is_warranty: data.is_warranty,
                warranty_duration: data.is_warranty ? (data.warranty_duration || null) : null,
            };

            const res = await fetch('/api/inventory/configurations/non-stock-item', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const json = await res.json().catch(() => ({}));
                throw new Error(json.error?.message ?? json.error ?? 'Failed to create item');
            }

            const json = await res.json();
            router.push(`/inventory/configurations/non-stock-item/${json.data.id}/view`);
            router.refresh();
        } catch (err) {
            setSubmitError(err instanceof Error ? err.message : 'Failed to save item');
        }
    };

    return (
        <div className="space-y-4 font-mono text-xs">
            <div>
                <Link
                    href="/inventory/configurations/non-stock-item"
                    className="inline-flex items-center gap-2 text-slate-500 transition-colors hover:text-slate-700"
                >
                    <ArrowLeft size={16} /> Back to Non-Stock Items
                </Link>
                <h2 className="mt-3 flex items-center gap-2 text-2xl font-bold text-slate-800 md:text-3xl">
                    <Package className="text-[#1a9e52]" /> New Non-Stock Item
                </h2>
            </div>

            {submitError && (
                <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                    <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-500" />
                    <p className="text-red-700">{submitError}</p>
                    <button type="button" onClick={() => setSubmitError('')} className="ml-auto shrink-0 text-red-400 hover:text-red-600">
                        <X size={16} />
                    </button>
                </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="grid gap-6 xl:grid-cols-[350px_minmax(0,1fr)]">
                {/* LEFT SIDEBAR */}
                <aside className="space-y-4 self-start xl:sticky xl:top-6">
                    <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
                        <div className="flex items-center gap-2 border-b border-slate-50 bg-slate-50/80 px-4 py-2.5">
                            <User size={13} className="text-[#1a9e52]" />
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Created By</span>
                        </div>
                        <div className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-[#1a9e52] to-emerald-700 font-bold text-white shadow-sm">
                                    {currentUser?.email?.[0]?.toUpperCase() ?? '?'}
                                </div>
                                <div className="min-w-0">
                                    <p className="truncate font-semibold text-slate-800">{currentUser?.email ?? 'Loading...'}</p>
                                    <span className="inline-flex items-center rounded-full bg-[#1a9e52]/10 px-2 py-0.5 text-[10px] font-semibold capitalize text-[#1a9e52]">
                                        {currentUser?.role ?? 'user'}
                                    </span>
                                </div>
                            </div>
                            <div className="mt-3 space-y-1.5 rounded-xl bg-slate-50 p-3">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="flex items-center gap-1.5 text-slate-400"><Building2 size={11} /> Company</span>
                                    <span className="font-semibold text-slate-700">#{currentUser?.companyId ?? '—'}</span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="flex items-center gap-1.5 text-slate-400"><CalendarDays size={11} /> Date</span>
                                    <span className="font-semibold text-slate-700">
                                        {createdAt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="flex items-center gap-1.5 text-slate-400"><Clock size={11} /> Time</span>
                                    <span className="font-semibold text-slate-700">
                                        {createdAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </section>

                    <div className="flex flex-col-reverse gap-2">
                        <Link
                            href="/inventory/configurations/non-stock-item"
                            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-center text-slate-600 transition-colors hover:bg-slate-50"
                        >
                            Cancel
                        </Link>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1a9e52] px-4 py-2.5 font-semibold text-white transition-colors hover:bg-[#158042] disabled:opacity-50"
                        >
                            {isSubmitting && <Loader2 className="animate-spin" size={16} />}
                            {isSubmitting ? 'Saving...' : 'Save Item'}
                        </button>
                    </div>
                </aside>

                {/* RIGHT — Tabs */}
                <div className="min-w-0">
                    <div className="flex gap-0 border-b border-slate-200">
                        {TABS.map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 border-b-2 px-5 py-3 transition-all ${
                                    activeTab === tab.id
                                        ? 'border-[#1a9e52] text-[#1a9e52]'
                                        : 'border-transparent text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                <span
                                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold transition-all ${
                                        activeTab === tab.id ? 'bg-[#1a9e52] text-white' : 'bg-slate-100 text-slate-500'
                                    }`}
                                >
                                    {tab.num}
                                </span>
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Tab 1: Details */}
                    {activeTab === 'details' && (
                        <div className="space-y-5 pt-5">
                            <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                                <h3 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                                    <Package size={13} className="text-[#1a9e52]" /> Item Information
                                </h3>
                                <div className="grid gap-4 lg:grid-cols-2">
                                    <div>
                                        <FieldLabel>Reference No</FieldLabel>
                                        <ReadonlyInput placeholder="Auto-generated" />
                                    </div>
                                    <div>
                                        <FieldLabel required>Item Name</FieldLabel>
                                        <EditableInput
                                            type="text"
                                            placeholder="e.g. Delivery Service"
                                            {...register('name', { required: 'Item name is required' })}
                                        />
                                        {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
                                    </div>
                                    <div>
                                        <FieldLabel>Barcode / SKU</FieldLabel>
                                        <EditableInput type="text" placeholder="Scan or type barcode..." {...register('sku')} />
                                    </div>
                                    <div>
                                        <Controller
                                            name="category_id"
                                            control={control}
                                            rules={{ required: 'Category is required' }}
                                            render={({ field }) => (
                                                <AsyncSearchSelect
                                                    label="Category"
                                                    placeholder="Select category..."
                                                    apiUrl="/api/inventory/configurations/category"
                                                    value={field.value}
                                                    selectedLabel={watch('category')?.name ?? ''}
                                                    popupTitle="Category"
                                                    enablePopupSearch
                                                    onChangeAction={(selected) => {
                                                        field.onChange(selected?.id ? Number(selected.id) : null);
                                                        setValue('category', { id: selected?.id ? Number(selected.id) : null, name: selected?.name ?? '' });
                                                    }}
                                                    required
                                                />
                                            )}
                                        />
                                        {errors.category_id && <p className="mt-1 text-xs text-red-500">{errors.category_id.message}</p>}
                                    </div>
                                    <div>
                                        <Controller
                                            name="uom_id"
                                            control={control}
                                            render={({ field }) => (
                                                <AsyncSearchSelect
                                                    label="Base UOM"
                                                    placeholder="Select unit of measure..."
                                                    apiUrl="/api/inventory/configurations/uom?status=active"
                                                    value={field.value}
                                                    selectedLabel={watch('uom')?.name ?? ''}
                                                    popupTitle="Base UOM"
                                                    enablePopupSearch
                                                    onChangeAction={(selected) => {
                                                        field.onChange(selected?.id ? Number(selected.id) : null);
                                                        setValue('uom', { id: selected?.id ? Number(selected.id) : null, name: selected?.name ?? '' });
                                                    }}
                                                />
                                            )}
                                        />
                                    </div>
                                </div>
                                <div className="mt-4">
                                    <FieldLabel>Description</FieldLabel>
                                    <EditableTextarea placeholder="Additional notes..." rows={3} {...register('description')} />
                                </div>
                            </section>

                            <div className="flex justify-end">
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('pricing')}
                                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-2.5 text-slate-600 transition-colors hover:bg-slate-50"
                                >
                                    Pricing <ChevronRight size={16} />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Tab 2: Pricing */}
                    {activeTab === 'pricing' && (
                        <div className="space-y-5 pt-5">
                            <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                                <h3 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                                    <Tag size={13} className="text-[#1a9e52]" /> Pricing
                                </h3>
                                <div className="grid gap-4 sm:grid-cols-3">
                                    <div>
                                        <FieldLabel>Cost ($)</FieldLabel>
                                        <EditableInput
                                            type="number" min={0} step="0.01"
                                            {...register('cost', { valueAsNumber: true, min: { value: 0, message: 'Must be ≥ 0' } })}
                                        />
                                    </div>
                                    <div>
                                        <FieldLabel required>Sale Price ($)</FieldLabel>
                                        <EditableInput
                                            type="number" min={0} step="0.01"
                                            {...register('price', { valueAsNumber: true, required: 'Sale price is required', min: { value: 0, message: 'Must be ≥ 0' } })}
                                        />
                                        {errors.price && <p className="mt-1 text-xs text-red-500">{errors.price.message}</p>}
                                    </div>
                                    <div>
                                        <FieldLabel>Profit</FieldLabel>
                                        <div
                                            className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold ${
                                                profit > 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                                : profit < 0 ? 'border-red-200 bg-red-50 text-red-600'
                                                : 'border-slate-200 bg-slate-50 text-slate-500'
                                            }`}
                                        >
                                            <BarChart3 size={14} />${profit.toFixed(2)}
                                            <span className="text-xs font-normal opacity-70">({profitMargin}%)</span>
                                        </div>
                                    </div>
                                    <div>
                                        <FieldLabel>Min Price ($)</FieldLabel>
                                        <EditableInput
                                            type="number" min={0} step="0.01" placeholder="—"
                                            {...register('min_price', { setValueAs: (v) => v === '' ? '' : Number(v) })}
                                        />
                                    </div>
                                    <div>
                                        <FieldLabel>Max Price ($)</FieldLabel>
                                        <EditableInput
                                            type="number" min={0} step="0.01" placeholder="—"
                                            {...register('max_price', { setValueAs: (v) => v === '' ? '' : Number(v) })}
                                        />
                                    </div>
                                </div>
                            </section>

                            <div className="flex justify-between">
                                <button type="button" onClick={() => setActiveTab('details')} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-2.5 text-slate-600 transition-colors hover:bg-slate-50">
                                    <ArrowLeft size={16} /> Details
                                </button>
                                <button type="button" onClick={() => setActiveTab('options')} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-2.5 text-slate-600 transition-colors hover:bg-slate-50">
                                    More Options <ChevronRight size={16} />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Tab 3: More Options */}
                    {activeTab === 'options' && (
                        <div className="space-y-5 pt-5">
                            <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                                <h3 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                                    <ShieldCheck size={13} className="text-[#1a9e52]" /> Item Properties
                                </h3>
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <Controller name="is_warranty" control={control} render={({ field }) => (
                                        <ToggleCheckbox checked={field.value ?? false} onChange={field.onChange} icon={<ShieldCheck size={16} />} label="Has Warranty" description="This item comes with a warranty" />
                                    )} />
                                    <Controller name="is_discount" control={control} render={({ field }) => (
                                        <ToggleCheckbox checked={field.value ?? false} onChange={field.onChange} icon={<Percent size={16} />} label="Discountable" description="Allow discounts on this item" />
                                    )} />
                                    <Controller name="is_returnable" control={control} render={({ field }) => (
                                        <ToggleCheckbox checked={field.value ?? false} onChange={field.onChange} icon={<RotateCcw size={16} />} label="Returnable" description="Allow customer returns" />
                                    )} />
                                    <Controller name="is_sellable" control={control} render={({ field }) => (
                                        <ToggleCheckbox checked={field.value ?? false} onChange={field.onChange} icon={<Tag size={16} />} label="Sellable" description="Show in POS for sale" />
                                    )} />
                                </div>
                                {isWarranty && (
                                    <div className="mt-4">
                                        <FieldLabel>Warranty Duration</FieldLabel>
                                        <EditableInput type="text" placeholder="e.g. 1 year, 6 months..." {...register('warranty_duration')} />
                                    </div>
                                )}
                            </section>

                            <div className="flex justify-start">
                                <button type="button" onClick={() => setActiveTab('pricing')} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-2.5 text-slate-600 transition-colors hover:bg-slate-50">
                                    <ArrowLeft size={16} /> Pricing
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </form>
        </div>
    );
}
