'use client';

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
    DollarSign,
    ShieldCheck,
    X,
    Plus,
    User,
    Building2,
    CalendarDays,
    Clock,
    FileText,
    Paperclip,
    Upload,
    Wrench,
    ChevronRight,
} from 'lucide-react';
import { useUserProfile } from '@/context/UserProfileContext';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import DeviceCreateModal from './DeviceCreateModal';
import CategoryCreateModal from './CategoryCreateModal';

// ─── Tab config ───────────────────────────────────────────────────────────────
const TABS = [
    { id: 'details' as const, label: 'Details', num: 1 },
    { id: 'pricing' as const, label: 'Pricing Details', num: 2 },
    { id: 'options' as const, label: 'More Options', num: 3 },
];
type TabId = (typeof TABS)[number]['id'];

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
function DifficultySelector({ value, onChange }: { value: string; onChange: (val: string) => void }) {
    const options = [
        { value: 'easy', label: 'ងាយ (Easy)', color: 'bg-emerald-50 border-emerald-200 text-emerald-700', activeColor: 'bg-emerald-500 border-emerald-500 text-white shadow-sm' },
        { value: 'normal', label: 'មធ្យម (Normal)', color: 'bg-blue-50 border-blue-200 text-blue-700', activeColor: 'bg-blue-500 border-blue-500 text-white shadow-sm' },
        { value: 'hard', label: 'ពិបាក (Hard)', color: 'bg-red-50 border-red-200 text-red-700', activeColor: 'bg-red-500 border-red-500 text-white shadow-sm' },
    ];
    return (
        <div className="flex flex-wrap gap-2">
            {options.map((opt) => (
                <button
                    key={opt.value}
                    type="button"
                    onClick={() => onChange(opt.value)}
                    className={`rounded-lg border px-3.5 py-2 text-xs font-semibold transition-all ${value === opt.value ? opt.activeColor : opt.color}`}
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

    const [activeTab, setActiveTab] = useState<TabId>('details');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const currentUser = useUserProfile();
    const [createdAt] = useState(() => new Date());
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

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
        min_price: '' as number | '',
        max_price: '' as number | '',
        warranty_duration: '',
        has_warranty: false,
        difficulty: 'normal',
        description: '',
    });

    // Modal state
    const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false);
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

    const handleDeviceCreated = (newDevice: ServiceDevice) => {
        setDevices((prev) => [...prev, newDevice].sort((a, b) => (a.brand || '').localeCompare(b.brand || '') || a.name.localeCompare(b.name)));
        setForm((prev) => ({ ...prev, device_id: newDevice.id }));
    };

    const handleCategoryCreated = (newCategory: ServiceCategory) => {
        setCategories((prev) => [...prev, newCategory].sort((a, b) => a.name.localeCompare(b.name)));
        setForm((prev) => ({ ...prev, category_id: newCategory.id }));
    };

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
            .finally(() => { if (!cancelled) setLoadingLookups(false); });
        return () => { cancelled = true; };
    }, []);

    const devicesByBrand = devices.reduce<Record<string, ServiceDevice[]>>((acc, d) => {
        const brand = d.brand || 'Other';
        if (!acc[brand]) acc[brand] = [];
        acc[brand].push(d);
        return acc;
    }, {});

    const topCategories = categories.filter((c) => !c.parent_id);
    const getSubCategories = (parentId: number) => categories.filter((c) => c.parent_id === parentId);

    const totalCost = Number(form.labor_cost) + Number(form.parts_cost);
    const profit = Number(form.sale_price) - totalCost;
    const selectedDevice = devices.find((d) => d.id === form.device_id);
    const selectedCategory = categories.find((c) => c.id === form.category_id);

    const handleSave = async (e: React.SyntheticEvent) => {
        e.preventDefault();
        setError('');
        if (!form.name.trim()) { setError('សូមបញ្ចូលឈ្មោះសេវាកម្ម។'); return; }
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
                min_price: form.min_price === '' ? null : Number(form.min_price),
                max_price: form.max_price === '' ? null : Number(form.max_price),
            };
            const response = await fetch('/api/repair-service', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message ?? errorData.error ?? 'បរាជ័យក្នុងការ​បង្កើតសេវាកម្ម។');
            }
            router.push(`/inventory/none_stock?create_success=true`);
            router.refresh();
        } catch (error: unknown) {
            setError(error instanceof Error ? error.message : 'មានបញ្ហាក្នុងការរក្សាទុក!');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
            {/* Header */}
            <div>
                <Link href="/inventory/none_stock" className="inline-flex items-center gap-2 text-sm text-slate-500 transition-colors hover:text-slate-700">
                    <ArrowLeft size={16} /> ត្រឡប់ទៅសេវាកម្ម
                </Link>
                <h2 className="mt-3 flex items-center gap-2 text-2xl font-bold text-slate-800 md:text-3xl">
                    <Wrench className="text-[#1a9e52]" /> បង្កើតសេវាកម្មជួសជុលថ្មី
                </h2>
                <p className="mt-1.5 text-sm text-slate-500">បំពេញព័ត៌មានសេវាកម្មជួសជុល ឧបករណ៍ តម្លៃពលកម្ម និងការធានា។</p>
            </div>

            {/* Error banner */}
            {error && (
                <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                    <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-500" />
                    <p className="text-sm text-red-700">{error}</p>
                    <button type="button" onClick={() => setError('')} className="ml-auto shrink-0 text-red-400 hover:text-red-600">
                        <X size={16} />
                    </button>
                </div>
            )}

            <form onSubmit={handleSave} className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">

                {/* ══════════════════════════════════
                    LEFT SIDEBAR
                   ══════════════════════════════════ */}
                <aside className="space-y-4 self-start xl:sticky xl:top-6">

                    {/* Created By */}
                    <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
                        <div className="flex items-center gap-2 border-b border-slate-50 bg-slate-50/80 px-4 py-2.5">
                            <User size={13} className="text-[#1a9e52]" />
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Created By</span>
                        </div>
                        <div className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#1a9e52] to-emerald-700 text-sm font-bold text-white shadow-sm">
                                    {currentUser?.email?.[0]?.toUpperCase() ?? '?'}
                                </div>
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-slate-800">{currentUser?.email ?? 'Loading...'}</p>
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

                    {/* Transaction Summary */}
                    <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
                        <div className="flex items-center gap-2 border-b border-slate-50 bg-slate-50/80 px-4 py-2.5">
                            <FileText size={13} className="text-[#1a9e52]" />
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Transaction Summary</span>
                        </div>
                        <div className="p-4">
                            <div className="space-y-1.5">
                                {[
                                    { label: 'Service', value: form.name || '—' },
                                    { label: 'Device', value: selectedDevice?.name ?? '—' },
                                    { label: 'Category', value: selectedCategory?.name ?? '—' },
                                    {
                                        label: 'Difficulty',
                                        value: form.difficulty === 'easy' ? 'ងាយ' : form.difficulty === 'hard' ? 'ពិបាក' : 'មធ្យម',
                                    },
                                    { label: 'Labor', value: `$${Number(form.labor_cost).toFixed(2)}` },
                                    { label: 'Parts', value: `$${Number(form.parts_cost).toFixed(2)}` },
                                    { label: 'Total Cost', value: `$${totalCost.toFixed(2)}` },
                                    { label: 'Sale Price', value: `$${Number(form.sale_price).toFixed(2)}` },
                                    {
                                        label: 'Profit',
                                        value: `$${profit.toFixed(2)}`,
                                        highlight: profit > 0 ? 'text-emerald-600' : profit < 0 ? 'text-red-500' : undefined,
                                    },
                                    { label: 'Warranty', value: form.has_warranty ? (form.warranty_duration || 'Yes') : 'No' },
                                ].map((row) => (
                                    <div key={row.label} className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-xs odd:bg-slate-50">
                                        <span className="text-slate-400">{row.label}</span>
                                        <span className={`truncate text-right font-semibold ${row.highlight ?? 'text-slate-700'}`}>{row.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>

                    {/* Attachment */}
                    <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
                        <div className="flex items-center gap-2 border-b border-slate-50 bg-slate-50/80 px-4 py-2.5">
                            <Paperclip size={13} className="text-[#1a9e52]" />
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Attachment</span>
                        </div>
                        <div className="p-4">
                            <input type="file" accept="image/*,.pdf,.doc,.docx" className="hidden" ref={fileInputRef} onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)} />
                            {selectedFile ? (
                                <div className="flex items-center gap-3 rounded-xl border border-[#1a9e52]/20 bg-[#1a9e52]/5 px-3 py-2.5">
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#1a9e52]/10">
                                        <Upload size={14} className="text-[#1a9e52]" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-xs font-semibold text-slate-700">{selectedFile.name}</p>
                                        <p className="text-[10px] text-slate-400">{(selectedFile.size / 1024).toFixed(0)} KB</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                                        className="shrink-0 rounded-full p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="flex w-full items-center gap-3 rounded-xl border border-dashed border-slate-200 px-3 py-3 text-left transition-colors hover:border-[#1a9e52]/50 hover:bg-[#1a9e52]/5"
                                >
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                                        <Upload size={14} className="text-slate-400" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold text-slate-600">Choose file</p>
                                        <p className="text-[10px] text-slate-400">Image, PDF, DOC</p>
                                    </div>
                                </button>
                            )}
                        </div>
                    </section>

                    {/* Action buttons */}
                    <div className="flex flex-col-reverse gap-2">
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
                            {isSaving && <Loader2 size={16} className="animate-spin" />}
                            {isSaving ? 'កំពុងរក្សាទុក...' : 'រក្សាទុក'}
                        </button>
                    </div>
                </aside>

                {/* ══════════════════════════════════
                    RIGHT — Tabs + Content
                   ══════════════════════════════════ */}
                <div className="min-w-0">
                    {/* Tab nav */}
                    <div className="flex gap-0 border-b border-slate-200">
                        {TABS.map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-medium transition-all ${
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

                    {/* ── Tab 1: Details ── */}
                    {activeTab === 'details' && (
                        <div className="space-y-5 pt-5">
                            <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                                <h3 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                                    <Wrench size={13} className="text-[#1a9e52]" /> ព័ត៌មានសេវាកម្ម
                                </h3>
                                <div className="grid gap-4 lg:grid-cols-2">
                                    <div>
                                        <FieldLabel>Reference No</FieldLabel>
                                        <ReadonlyInput placeholder="Auto-generated" />
                                    </div>
                                    <div>
                                        <FieldLabel required>ឈ្មោះសេវាកម្ម</FieldLabel>
                                        <EditableInput
                                            type="text"
                                            value={form.name}
                                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                                            placeholder="ឧ. ប្តូរអេក្រង់, ប្តូរ Battery..."
                                            required
                                        />
                                    </div>

                                    {/* Device */}
                                    <div>
                                        <div className="mb-1.5 flex items-center justify-between">
                                            <FieldLabel className="mb-0">ឧបករណ៍ (Device)</FieldLabel>
                                            <button
                                                type="button"
                                                onClick={() => setIsDeviceModalOpen(true)}
                                                className="flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 transition-colors hover:bg-slate-200"
                                            >
                                                <Plus size={12} /> ថ្មី
                                            </button>
                                        </div>
                                        <select
                                            value={form.device_id ?? ''}
                                            onChange={(e) => setForm({ ...form, device_id: e.target.value ? Number(e.target.value) : null })}
                                            disabled={loadingLookups}
                                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50"
                                        >
                                            <option value="">{loadingLookups ? 'កំពុងទាញយក...' : 'ជ្រើសរើសឧបករណ៍...'}</option>
                                            {Object.entries(devicesByBrand).map(([brand, devs]) => (
                                                <optgroup key={brand} label={brand}>
                                                    {devs.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                                                </optgroup>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Category */}
                                    <div>
                                        <div className="mb-1.5 flex items-center justify-between">
                                            <FieldLabel className="mb-0">ប្រភេទសេវាកម្ម (Category)</FieldLabel>
                                            <button
                                                type="button"
                                                onClick={() => setIsCategoryModalOpen(true)}
                                                className="flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 transition-colors hover:bg-slate-200"
                                            >
                                                <Plus size={12} /> ថ្មី
                                            </button>
                                        </div>
                                        <select
                                            value={form.category_id ?? ''}
                                            onChange={(e) => setForm({ ...form, category_id: e.target.value ? Number(e.target.value) : null })}
                                            disabled={loadingLookups}
                                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50"
                                        >
                                            <option value="">ជ្រើសរើសប្រភេទ...</option>
                                            {topCategories.map((cat) => {
                                                const subs = getSubCategories(cat.id);
                                                if (subs.length > 0) {
                                                    return (
                                                        <optgroup key={cat.id} label={cat.name}>
                                                            <option value={cat.id}>{cat.name} (All)</option>
                                                            {subs.map((sub) => <option key={sub.id} value={sub.id}>└ {sub.name}</option>)}
                                                        </optgroup>
                                                    );
                                                }
                                                return <option key={cat.id} value={cat.id}>{cat.name}</option>;
                                            })}
                                        </select>
                                    </div>

                                    {/* Difficulty */}
                                    <div className="lg:col-span-2">
                                        <FieldLabel>កម្រិតការជួសជុល (Difficulty)</FieldLabel>
                                        <DifficultySelector value={form.difficulty} onChange={(val) => setForm({ ...form, difficulty: val })} />
                                    </div>
                                </div>
                            </section>

                            <div className="flex justify-end">
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('pricing')}
                                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
                                >
                                    Pricing Details <ChevronRight size={16} />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── Tab 2: Pricing Details ── */}
                    {activeTab === 'pricing' && (
                        <div className="space-y-5 pt-5">
                            <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                                <h3 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                                    <DollarSign size={13} className="text-[#1a9e52]" /> តម្លៃ
                                </h3>
                                <div className="grid gap-4 sm:grid-cols-3">
                                    <div>
                                        <FieldLabel>ថ្លៃពលកម្ម (Labor Cost)</FieldLabel>
                                        <EditableInput
                                            type="number" min={0} step="0.01"
                                            value={form.labor_cost}
                                            onChange={(e) => setForm({ ...form, labor_cost: Number(e.target.value) })}
                                            placeholder="0.00"
                                        />
                                    </div>
                                    <div>
                                        <FieldLabel>ថ្លៃគ្រឿងផ្គួប (Parts Cost)</FieldLabel>
                                        <EditableInput
                                            type="number" min={0} step="0.01"
                                            value={form.parts_cost}
                                            onChange={(e) => setForm({ ...form, parts_cost: Number(e.target.value) })}
                                            placeholder="0.00"
                                        />
                                        <p className="mt-1 text-[10px] text-slate-400">ថ្លៃអេក្រង់, battery ផ្សេងៗ</p>
                                    </div>
                                    <div>
                                        <FieldLabel required>តម្លៃលក់ (Sale Price)</FieldLabel>
                                        <EditableInput
                                            type="number" min={0} step="0.01"
                                            value={form.sale_price}
                                            onChange={(e) => setForm({ ...form, sale_price: Number(e.target.value) })}
                                            placeholder="0.00"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <FieldLabel>តម្លៃអប្បបរមា (Min Price)</FieldLabel>
                                        <EditableInput
                                            type="number" min={0} step="0.01"
                                            value={form.min_price}
                                            onChange={(e) => setForm({ ...form, min_price: e.target.value === '' ? '' : Number(e.target.value) })}
                                            placeholder="ឧ. 0.00"
                                        />
                                        <p className="mt-1 text-[10px] text-slate-400">តម្លៃទាបបំផុតដែលអាចលក់</p>
                                    </div>
                                    <div>
                                        <FieldLabel>តម្លៃអតិបរមា (Max Price)</FieldLabel>
                                        <EditableInput
                                            type="number" min={0} step="0.01"
                                            value={form.max_price}
                                            onChange={(e) => setForm({ ...form, max_price: e.target.value === '' ? '' : Number(e.target.value) })}
                                            placeholder="ឧ. 999.00"
                                        />
                                        <p className="mt-1 text-[10px] text-slate-400">តម្លៃខ្ពស់បំផុតដែលអាចលក់</p>
                                    </div>
                                </div>

                                <div
                                    className={`mt-4 flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold ${
                                        profit > 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                        : profit < 0 ? 'border-red-200 bg-red-50 text-red-600'
                                        : 'border-slate-200 bg-slate-50 text-slate-500'
                                    }`}
                                >
                                    <DollarSign size={14} />
                                    ប្រាក់ចំណេញ: ${profit.toFixed(2)}
                                    <span className="text-xs font-normal opacity-70">
                                        (Labor ${Number(form.labor_cost).toFixed(2)} + Parts ${Number(form.parts_cost).toFixed(2)} = ${totalCost.toFixed(2)})
                                    </span>
                                </div>
                            </section>

                            <div className="flex justify-between">
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('details')}
                                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
                                >
                                    <ArrowLeft size={16} /> Details
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('options')}
                                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
                                >
                                    More Options <ChevronRight size={16} />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── Tab 3: More Options ── */}
                    {activeTab === 'options' && (
                        <div className="space-y-5 pt-5">
                            <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                                <h3 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                                    <ShieldCheck size={13} className="text-[#1a9e52]" /> ការធានា
                                </h3>
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <label
                                        className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-all ${
                                            form.has_warranty ? 'border-blue-200 bg-blue-50/60 shadow-sm' : 'border-slate-100 bg-white hover:border-slate-200'
                                        }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={form.has_warranty}
                                            onChange={(e) => setForm({ ...form, has_warranty: e.target.checked })}
                                            className="sr-only"
                                        />
                                        <div className={`flex h-5 w-5 items-center justify-center rounded-md border-2 transition-all ${form.has_warranty ? 'border-blue-500 bg-blue-500 text-white' : 'border-slate-300 bg-white'}`}>
                                            {form.has_warranty && (
                                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                                    <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                                </svg>
                                            )}
                                        </div>
                                        <div>
                                            <span className={`text-sm font-semibold ${form.has_warranty ? 'text-blue-800' : 'text-slate-700'}`}>មានការធានា</span>
                                            <p className="text-xs text-slate-400">សេវាកម្មនេះមានធានាអោយអតិថិជន</p>
                                        </div>
                                    </label>
                                    <div>
                                        <FieldLabel>រយៈពេលធានា</FieldLabel>
                                        <EditableInput
                                            type="text"
                                            value={form.warranty_duration}
                                            onChange={(e) => setForm({ ...form, warranty_duration: e.target.value })}
                                            placeholder="ឧ. 3 months, 1 year..."
                                            disabled={!form.has_warranty}
                                        />
                                    </div>
                                </div>
                            </section>

                            <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                                <FieldLabel>កំណត់ចំណាំ (Notes)</FieldLabel>
                                <EditableTextarea
                                    value={form.description}
                                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                                    placeholder="ព័ត៌មានបន្ថែម... ឧ. ត្រូវការគ្រឿងផ្គួបពី supplier X"
                                    rows={4}
                                />
                            </section>

                            <div className="flex justify-start">
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('pricing')}
                                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
                                >
                                    <ArrowLeft size={16} /> Pricing Details
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </form>

            <DeviceCreateModal open={isDeviceModalOpen} onOpenChange={setIsDeviceModalOpen} onSuccess={handleDeviceCreated} />
            <CategoryCreateModal open={isCategoryModalOpen} onOpenChange={setIsCategoryModalOpen} topCategories={topCategories} onSuccess={handleCategoryCreated} />
        </div>
    );
}
