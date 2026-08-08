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
    X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export type NonStockEditItem = {
    id: number;
    name: string;
    reference_no: string | null;
    sku: string | null;
    description: string | null;
    item_class: string;
    price: number;
    min_price: number | null;
    max_price: number | null;
    cost: number | null;
    is_variant: boolean;
    is_discount: boolean;
    is_sellable: boolean;
    is_returnable: boolean;
    is_warranty: boolean;
    warranty_duration: string | null;
    category_id: number | null;
    uom_id: number | null;
    created_at: string;
    category: { id: number; name: string; reference_no?: string } | null;
    uom: { id: number; name: string } | null;
    company: { id: number; name: string } | null;
};

const TABS = [
    { id: 'details' as const, label: 'Details', num: 1 },
    { id: 'pricing' as const, label: 'Pricing', num: 2 },
    { id: 'options' as const, label: 'More Options', num: 3 },
];
type TabId = (typeof TABS)[number]['id'];

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
            <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only" />
            <div
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all ${
                    checked ? 'border-blue-500 bg-blue-500 text-white' : 'border-slate-300 bg-white'
                }`}
            >
                {checked && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                )}
            </div>
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <span className={checked ? 'text-blue-600' : 'text-slate-400'}>{icon}</span>
                    <span className={`text-xs ${checked ? 'text-blue-800' : 'text-slate-700'}`}>{label}</span>
                </div>
                <p className="mt-0.5 text-xs text-slate-400">{description}</p>
            </div>
        </label>
    );
}

export default function NonStockItemEditForm({ item }: { item: NonStockEditItem }) {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<TabId>('details');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const createdAt = new Date(item.created_at);

    const [formData, setFormData] = useState({
        name: item.name ?? '',
        sku: item.sku ?? '',
        description: item.description ?? '',
        price: item.price ?? 0,
        cost: item.cost ?? 0,
        min_price: item.min_price ?? ('' as number | ''),
        max_price: item.max_price ?? ('' as number | ''),
        category_id: item.category_id,
        category: item.category ?? { id: null, name: '' },
        uom_id: item.uom_id,
        uom: item.uom ?? { id: null, name: '' },
        is_discount: item.is_discount,
        is_variant: item.is_variant,
        is_sellable: item.is_sellable,
        is_returnable: item.is_returnable,
        is_warranty: item.is_warranty || !!item.warranty_duration,
        warranty_duration: item.warranty_duration ?? '',
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: name === 'price' || name === 'cost' ? Number(value) : value,
        }));
    };

    const handleSave = async (e: React.SyntheticEvent) => {
        e.preventDefault();
        setError('');
        setIsSaving(true);
        try {
            const payload = {
                name: formData.name,
                sku: formData.sku || null,
                description: formData.description || null,
                price: formData.price,
                cost: formData.cost || null,
                min_price: formData.min_price === '' ? null : Number(formData.min_price),
                max_price: formData.max_price === '' ? null : Number(formData.max_price),
                category_id: formData.category_id,
                uom_id: formData.uom_id,
                is_discount: formData.is_discount,
                is_variant: formData.is_variant,
                is_sellable: formData.is_sellable,
                is_returnable: formData.is_returnable,
                is_warranty: formData.is_warranty,
                warranty_duration: formData.is_warranty ? (formData.warranty_duration || null) : null,
            };

            const res = await fetch(`/api/inventory/configurations/non-stock-item/${item.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const json = await res.json().catch(() => ({}));
                throw new Error(json.error?.message ?? json.error ?? 'Update failed');
            }

            router.push(`/inventory/configurations/non-stock-item/${item.id}/view`);
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save changes');
        } finally {
            setIsSaving(false);
        }
    };

    const profit = Number(formData.price) - Number(formData.cost);
    const profitMargin = Number(formData.price) > 0 ? ((profit / Number(formData.price)) * 100).toFixed(1) : '0.0';

    return (
        <div className="space-y-4 font-mono">
            <div>
                <Link
                    href={`/inventory/configurations/non-stock-item/${item.id}/view`}
                    className="inline-flex items-center gap-2 text-sm text-slate-500 transition-colors hover:text-slate-700"
                >
                    <ArrowLeft size={16} /> Back
                </Link>
                <h2 className="mt-3 flex items-center gap-2 text-2xl font-bold text-slate-800 md:text-3xl">
                    <Package className="text-[#1a9e52]" />Non-Stock
                </h2>
            </div>

            {error && (
                <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                    <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-500" />
                    <p className="text-sm text-red-700">{error}</p>
                    <button type="button" onClick={() => setError('')} className="ml-auto shrink-0 text-red-400 hover:text-red-600">
                        <X size={16} />
                    </button>
                </div>
            )}

            <form onSubmit={handleSave} className="grid gap-6 xl:grid-cols-[350px_minmax(0,1fr)] text-xs">
                {/* LEFT SIDEBAR */}
                <aside className="space-y-4 self-start xl:sticky xl:top-6">
                    <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
                        <div className="flex items-center gap-2 border-b border-slate-50 bg-slate-50/80 px-4 py-2.5">
                            <Building2 size={13} className="text-[#1a9e52]" />
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Item Info</span>
                        </div>
                        <div className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-[#1a9e52] to-emerald-700 text-sm font-bold text-white shadow-sm">
                                    {item.name?.[0]?.toUpperCase() ?? 'I'}
                                </div>
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-slate-800">{item.name}</p>
                                    <span className="inline-flex items-center rounded-full bg-[#1a9e52]/10 px-2 py-0.5 text-[10px] font-semibold capitalize text-[#1a9e52]">
                                        {item.company?.name ?? 'N/A'}
                                    </span>
                                </div>
                            </div>
                            <div className="mt-3 space-y-1.5 rounded-xl bg-slate-50 p-3">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="flex items-center gap-1.5 text-slate-400"><Building2 size={11} /> Company</span>
                                    <span className="font-semibold text-slate-700">{item.company?.name ?? '—'}</span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="flex items-center gap-1.5 text-slate-400"><CalendarDays size={11} /> Created</span>
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
                            href={`/inventory/configurations/non-stock-item/${item.id}/view`}
                            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-center text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
                        >
                            Cancel
                        </Link>
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1a9e52] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#158042] disabled:opacity-50"
                        >
                            {isSaving && <Loader2 className="animate-spin" size={16} />}
                            {isSaving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </aside>

                {/* RIGHT — Tabs */}
                <div className="min-w-0 text-xs">
                    <div className="flex gap-0 border-b border-slate-200">
                        {TABS.map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 border-b-2 px-5 py-3 transition-all ${
                                    activeTab === tab.id ? 'border-[#1a9e52] text-[#1a9e52]' : 'border-transparent text-slate-500 hover:text-slate-700'
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
                                        <ReadonlyInput value={item.reference_no ?? ''} placeholder="Auto-generated" />
                                    </div>
                                    <div>
                                        <FieldLabel required>Item Name</FieldLabel>
                                        <EditableInput
                                            type="text"
                                            name="name"
                                            required
                                            value={formData.name}
                                            onChange={handleChange}
                                            placeholder="e.g. Delivery Service"
                                        />
                                    </div>
                                    <div>
                                        <FieldLabel>Barcode / SKU</FieldLabel>
                                        <EditableInput
                                            type="text"
                                            name="sku"
                                            value={formData.sku}
                                            onChange={handleChange}
                                            placeholder="Scan or type barcode..."
                                        />
                                    </div>
                                    <div>
                                        <AsyncSearchSelect
                                            label="Category"
                                            placeholder="Select category..."
                                            apiUrl="/api/inventory/configurations/category"
                                            value={formData.category_id}
                                            selectedLabel={formData.category?.name ?? ''}
                                            popupTitle="Category"
                                            enablePopupSearch
                                            onChangeAction={(selected) =>
                                                setFormData((prev) => ({
                                                    ...prev,
                                                    category_id: selected?.id ? Number(selected.id) : null,
                                                    category: { id: selected?.id ? Number(selected.id) : null, name: selected?.name ?? '' },
                                                }))
                                            }
                                            required
                                        />
                                    </div>
                                    <div>
                                        <AsyncSearchSelect
                                            label="Base UOM"
                                            placeholder="Select unit of measure..."
                                            apiUrl="/api/inventory/configurations/uom?status=active"
                                            value={formData.uom_id}
                                            selectedLabel={formData.uom?.name ?? ''}
                                            popupTitle="Base UOM"
                                            enablePopupSearch
                                            onChangeAction={(selected) =>
                                                setFormData((prev) => ({
                                                    ...prev,
                                                    uom_id: selected?.id ? Number(selected.id) : null,
                                                    uom: { id: selected?.id ? Number(selected.id) : null, name: selected?.name ?? '' },
                                                }))
                                            }
                                        />
                                    </div>
                                </div>
                                <div className="mt-4">
                                    <FieldLabel>Description</FieldLabel>
                                    <EditableTextarea
                                        name="description"
                                        value={formData.description ?? ''}
                                        onChange={handleChange}
                                        placeholder="Additional notes..."
                                        rows={3}
                                    />
                                </div>
                            </section>

                            <div className="flex justify-end">
                                <button type="button" onClick={() => setActiveTab('pricing')} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-2.5 text-slate-600 transition-colors hover:bg-slate-50">
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
                                        <EditableInput name="cost" type="number" min={0} step="0.01" value={formData.cost} onChange={handleChange} />
                                    </div>
                                    <div>
                                        <FieldLabel required>Sale Price ($)</FieldLabel>
                                        <EditableInput name="price" type="number" min={0} step="0.01" value={formData.price} onChange={handleChange} required />
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
                                            name="min_price" type="number" min={0} step="0.01" value={formData.min_price}
                                            onChange={(e) => setFormData((p) => ({ ...p, min_price: e.target.value === '' ? '' : Number(e.target.value) }))}
                                            placeholder="—"
                                        />
                                    </div>
                                    <div>
                                        <FieldLabel>Max Price ($)</FieldLabel>
                                        <EditableInput
                                            name="max_price" type="number" min={0} step="0.01" value={formData.max_price}
                                            onChange={(e) => setFormData((p) => ({ ...p, max_price: e.target.value === '' ? '' : Number(e.target.value) }))}
                                            placeholder="—"
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
                                    <ToggleCheckbox
                                        checked={formData.is_warranty}
                                        onChange={(val) => setFormData((p) => ({ ...p, is_warranty: val }))}
                                        icon={<ShieldCheck size={16} />}
                                        label="Has Warranty"
                                        description="This item comes with a warranty"
                                    />
                                    <ToggleCheckbox
                                        checked={formData.is_discount}
                                        onChange={(val) => setFormData((p) => ({ ...p, is_discount: val }))}
                                        icon={<Percent size={16} />}
                                        label="Discountable"
                                        description="Allow discounts on this item"
                                    />
                                    <ToggleCheckbox
                                        checked={formData.is_returnable}
                                        onChange={(val) => setFormData((p) => ({ ...p, is_returnable: val }))}
                                        icon={<RotateCcw size={16} />}
                                        label="Returnable"
                                        description="Allow customer returns"
                                    />
                                    {/* <ToggleCheckbox
                                        checked={formData.is_sellable}
                                        onChange={(val) => setFormData((p) => ({ ...p, is_sellable: val }))}
                                        icon={<Tag size={16} />}
                                        label="Sellable"
                                        description="Show in POS for sale"
                                    /> */}
                                </div>
                                {formData.is_warranty && (
                                    <div className="mt-4">
                                        <FieldLabel>Warranty Duration</FieldLabel>
                                        <EditableInput
                                            type="text"
                                            name="warranty_duration"
                                            value={formData.warranty_duration}
                                            onChange={handleChange}
                                            placeholder="e.g. 1 year, 6 months..."
                                        />
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
