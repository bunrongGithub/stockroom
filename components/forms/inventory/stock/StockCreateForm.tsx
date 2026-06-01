'use client';

import AsyncSearchSelect from '@/components/ui/AsyncSearchSelect';
import {
    EditableInput,
    EditableTextarea,
    FieldLabel,
} from '@/components/ui/FieldLabel';
import { ReadonlyInput } from '@/components/ui/Readonly';
import { StockLocationProps } from '@/types/branch';
import { InventoryItemProps } from '@/types/inventory/item';
import {
    ArrowLeft,
    AlertCircle,
    Loader2,
    Package,
    Upload,
    X,
    ShieldCheck,
    Percent,
    RotateCcw,
    Tag,
    Truck,
    BarChart3,
    ScanBarcode,
    User,
    Building2,
    CalendarDays,
    Clock,
    Paperclip,
    ChevronRight,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';

// ─── Tab config ───────────────────────────────────────────────────────────────
const TABS = [
    { id: 'details' as const, label: 'Details', num: 1 },
    { id: 'pricing' as const, label: 'Pricing Details', num: 2 },
    { id: 'options' as const, label: 'More Options', num: 3 },
];
type TabId = (typeof TABS)[number]['id'];

// ─── Form values ──────────────────────────────────────────────────────────────
// Flatten the intersection so react-hook-form can satisfy its FieldValues constraint
type Simplify<T> = { [K in keyof T]: T[K] };
type FormValues = Simplify<
    InventoryItemProps & {
        location_id: number | '';
        initial_quantity: number | '';
    }
>;

// ─── Toggle Checkbox ──────────────────────────────────────────────────────────
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
                    <span
                        className={`${checked ? 'text-blue-600' : 'text-slate-400'}`}
                    >
                        {icon}
                    </span>
                    <span
                        className={`text-sm font-semibold ${checked ? 'text-blue-800' : 'text-slate-700'}`}
                    >
                        {label}
                    </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-400">{description}</p>
            </div>
        </label>
    );
}

// ─── Condition Selector ───────────────────────────────────────────────────────
function ConditionSelector({
    value,
    onChange,
}: {
    value: string;
    onChange: (val: string) => void;
}) {
    const options = [
        {
            value: 'new',
            label: 'ថ្មី (New)',
            color: 'bg-emerald-50 border-emerald-200 text-emerald-700',
            activeColor:
                'bg-emerald-500 border-emerald-500 text-white shadow-sm',
        },
        {
            value: 'used',
            label: 'មួយទឹក (Used)',
            color: 'bg-amber-50 border-amber-200 text-amber-700',
            activeColor: 'bg-amber-500 border-amber-500 text-white shadow-sm',
        },
        {
            value: 'refurbished',
            label: 'Refurbished',
            color: 'bg-blue-50 border-blue-200 text-blue-700',
            activeColor: 'bg-blue-500 border-blue-500 text-white shadow-sm',
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
export default function StockCreateForm() {
    const router = useRouter();

    const [activeTab, setActiveTab] = useState<TabId>('details');
    const [isUploadingImage, setIsUploadingImage] = useState(false);
    const [uploadedImageUrl, setUploadedImageUrl] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [submitError, setSubmitError] = useState('');
    const [locations, setLocations] = useState<StockLocationProps[]>([]);
    const [loadingLocations, setLoadingLocations] = useState(true);
    const [currentUser, setCurrentUser] = useState<{
        email: string;
        role: string;
        companyId: string;
    } | null>(null);
    const [createdAt] = useState(() => new Date());

    const fileInputRef = useRef<HTMLInputElement>(null);

    const {
        register,
        control,
        handleSubmit,
        watch,
        setValue,
        formState: { errors, isSubmitting },
    } = useForm<FormValues>({
        defaultValues: {
            id: null,
            name: '',
            item_class: 'stock',
            reference_no: '',
            purchase_price: 0,
            sale_price: 0,
            description: '',
            stock: null,
            stock_entry: null,
            category_id: null,
            category: { id: null, name: '' },
            uom_id: null,
            uom: { id: null, name: '' },
            images_url: [],
            condition: 'new',
            brand: '',
            supplier: '',
            barcode: '',
            min_stock: null,
            min_price: null,
            max_price: null,
            has_warranty: false,
            is_discount: true,
            is_returnable: false,
            is_sellable: true,
            location_id: '',
            initial_quantity: 0,
        },
    });

    const purchasePrice = watch('purchase_price');
    const salePrice = watch('sale_price');

    const profit = Number(salePrice) - Number(purchasePrice);
    const profitMargin =
        Number(salePrice) > 0
            ? ((profit / Number(salePrice)) * 100).toFixed(1)
            : '0.0';
    useEffect(() => {
        fetch('/api/auth/me')
            .then((r) => r.json())
            .then((d) =>
                setCurrentUser({
                    email: d.email,
                    role: d.role,
                    companyId: d.companyId,
                }),
            )
            .catch(() => {});
    }, []);
    useEffect(() => {
        let cancelled = false;
        async function loadLocations() {
            try {
                const res = await fetch('/api/inventory/stock-location');
                const json = await res.json();
                if (!res.ok)
                    throw new Error(
                        json.error ?? 'Failed to load stock locations',
                    );
                const data: StockLocationProps[] = json.data ?? [];
                if (cancelled) return;
                setLocations(data);
                const defaultLocation =
                    data.find((l) => l.is_default) ?? data[0];
                if (defaultLocation)
                    setValue('location_id', defaultLocation.id);
            } catch (err) {
                if (!cancelled)
                    setSubmitError(
                        err instanceof Error
                            ? err.message
                            : 'Failed to load stock locations',
                    );
            } finally {
                if (!cancelled) setLoadingLocations(false);
            }
        }
        loadLocations();
        return () => {
            cancelled = true;
        };
    }, [setValue]);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 32 * 1024 * 1024) {
            setSubmitError('សូមជ្រើសរើសរូបភាពដែលមានទំហំតូចជាង 32MB');
            return;
        }
        setSubmitError('');
        setUploadedImageUrl('');
        setSelectedFile(file);
        setIsUploadingImage(false);
    };

    const removeImage = () => {
        setUploadedImageUrl('');
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const onSubmit = async (data: FormValues) => {
        setSubmitError('');

        const quantity =
            data.initial_quantity === '' ? 0 : Number(data.initial_quantity);
        if (Number.isNaN(quantity) || quantity < 0) {
            setSubmitError('សូមបញ្ចូលចំនួនស្តុកដំបូងត្រឹមត្រូវ។');
            return;
        }
        if (loadingLocations) {
            setSubmitError('កំពុងទាញយកទីតាំងស្តុក។ សូមរង់ចាំបន្តិច។');
            return;
        }
        if (locations.length === 0) {
            setSubmitError(
                'មិនមានទីតាំងស្តុក។ សូមបង្កើត Storage Location ជាមុនសិន',
            );
            return;
        }
        if (!data.location_id) {
            setSubmitError('សូមជ្រើសរើសទីតាំងស្តុក។');
            return;
        }

        try {
            let finalImageUrl = '';
            if (selectedFile) {
                const imgFormData = new FormData();
                imgFormData.append('image', selectedFile);
                const imgbbApiKey = process.env.NEXT_PUBLIC_IMGBB_API_KEY;
                if (!imgbbApiKey) throw new Error('រកមិនឃើញ ImgBB API Key!');
                const imgResponse = await fetch(
                    `https://api.imgbb.com/1/upload?key=${imgbbApiKey}`,
                    { method: 'POST', body: imgFormData },
                );
                const imgData = await imgResponse.json();
                if (!imgData.success)
                    throw new Error('បរាជ័យក្នុងការ Upload រូបភាព');
                finalImageUrl = imgData.data.url;
                setUploadedImageUrl(finalImageUrl);
            }

            const payload = {
                name: data.name,
                item_class: data.item_class,
                reference_no: data.reference_no,
                cost: data.purchase_price,
                price: data.sale_price,
                description: data.description,
                category_id: data.category_id,
                uom_id: data.uom_id,
                images_url: finalImageUrl ? [finalImageUrl] : [],
                sku: data.barcode || null,
                brand: data.brand || null,
                condition: data.condition,
                min_price: data.min_price,
                max_price: data.max_price,
                is_discount: data.is_discount,
            };

            const response = await fetch('/api/inventory', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(
                    errorData.message ??
                        errorData.error ??
                        'បរាជ័យក្នុងការ​បង្កើត​ទំនិញ។',
                );
            }

            const resData = await response.json();
            const newItemId = resData.data?.id;

            if (quantity > 0 && newItemId) {
                const stockResponse = await fetch(
                    `/api/inventory/${newItemId}/adjust`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            received_quantity: quantity,
                            adjustment_reason: 'Initial stock',
                            location_id: data.location_id,
                            movement_type: 'in',
                        }),
                    },
                );
                if (!stockResponse.ok) {
                    const stockError = await stockResponse
                        .json()
                        .catch(() => ({}));
                    throw new Error(
                        stockError.error ??
                            stockError.message ??
                            'Item was created, but initial stock could not be saved.',
                    );
                }
            }

            router.push(
                `/inventory/configurations/stock/${resData.data.id}/view?create_success=${true}&stock=${true}`,
            );
            router.refresh();
        } catch (error: unknown) {
            setSubmitError(
                error instanceof Error
                    ? error.message
                    : 'មានបញ្ហាក្នុងការរក្សាទុក!',
            );
        }
    };

    return (
        <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
            {/* Header */}
            <div>
                <Link
                    href="/inventory"
                    className="inline-flex items-center gap-2 text-sm text-slate-500 transition-colors hover:text-slate-700"
                >
                    <ArrowLeft size={16} /> ត្រឡប់ទៅឃ្លាំងទំនិញ
                </Link>
                <h2 className="mt-3 flex items-center gap-2 text-2xl font-bold text-slate-800 md:text-3xl">
                    <Package className="text-[#1a9e52]" /> បន្ថែមទំនិញថ្មី
                </h2>
            </div>

            {/* Error banner */}
            {submitError && (
                <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                    <AlertCircle
                        size={18}
                        className="mt-0.5 shrink-0 text-red-500"
                    />
                    <p className="text-sm text-red-700">{submitError}</p>
                    <button
                        type="button"
                        onClick={() => setSubmitError('')}
                        className="ml-auto shrink-0 text-red-400 hover:text-red-600"
                    >
                        <X size={16} />
                    </button>
                </div>
            )}

            <form
                onSubmit={handleSubmit(onSubmit)}
                className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]"
            >
                {/* ══════════════════════════════════
                    LEFT SIDEBAR
                   ══════════════════════════════════ */}
                <aside className="space-y-4 self-start xl:sticky xl:top-6">
                    {/* Created By */}
                    <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
                        <div className="flex items-center gap-2 border-b border-slate-50 bg-slate-50/80 px-4 py-2.5">
                            <User size={13} className="text-[#1a9e52]" />
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                Created By
                            </span>
                        </div>
                        <div className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#1a9e52] to-emerald-700 text-sm font-bold text-white shadow-sm">
                                    {currentUser?.email?.[0]?.toUpperCase() ??
                                        '?'}
                                </div>
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-slate-800">
                                        {currentUser?.email ?? 'Loading...'}
                                    </p>
                                    <span className="inline-flex items-center rounded-full bg-[#1a9e52]/10 px-2 py-0.5 text-[10px] font-semibold capitalize text-[#1a9e52]">
                                        {currentUser?.role ?? 'user'}
                                    </span>
                                </div>
                            </div>
                            <div className="mt-3 space-y-1.5 rounded-xl bg-slate-50 p-3">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="flex items-center gap-1.5 text-slate-400">
                                        <Building2 size={11} /> Company
                                    </span>
                                    <span className="font-semibold text-slate-700">
                                        #{currentUser?.companyId ?? '—'}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="flex items-center gap-1.5 text-slate-400">
                                        <CalendarDays size={11} /> Date
                                    </span>
                                    <span className="font-semibold text-slate-700">
                                        {createdAt.toLocaleDateString('en-GB', {
                                            day: '2-digit',
                                            month: 'short',
                                            year: 'numeric',
                                        })}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="flex items-center gap-1.5 text-slate-400">
                                        <Clock size={11} /> Time
                                    </span>
                                    <span className="font-semibold text-slate-700">
                                        {createdAt.toLocaleTimeString('en-US', {
                                            hour: '2-digit',
                                            minute: '2-digit',
                                        })}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Upload / Attachment */}
                    <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
                        <div className="flex items-center gap-2 border-b border-slate-50 bg-slate-50/80 px-4 py-2.5">
                            <Paperclip size={13} className="text-[#1a9e52]" />
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                Product Image
                            </span>
                        </div>
                        <div className="p-4">
                            <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                ref={fileInputRef}
                                onChange={handleImageUpload}
                            />
                            {selectedFile ? (
                                <div className="flex items-center gap-3 rounded-xl border border-[#1a9e52]/20 bg-[#1a9e52]/5 px-3 py-2.5">
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#1a9e52]/10">
                                        <Upload
                                            size={14}
                                            className="text-[#1a9e52]"
                                        />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-xs font-semibold text-slate-700">
                                            {selectedFile.name}
                                        </p>
                                        <p className="text-[10px] text-slate-400">
                                            {(selectedFile.size / 1024).toFixed(
                                                0,
                                            )}{' '}
                                            KB
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={removeImage}
                                        className="shrink-0 rounded-full p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() =>
                                        fileInputRef.current?.click()
                                    }
                                    className="flex w-full items-center gap-3 rounded-xl border border-dashed border-slate-200 px-3 py-3 text-left transition-colors hover:border-[#1a9e52]/50 hover:bg-[#1a9e52]/5"
                                >
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                                        <Upload
                                            size={14}
                                            className="text-slate-400"
                                        />
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold text-slate-600">
                                            Choose image
                                        </p>
                                        <p className="text-[10px] text-slate-400">
                                            PNG, JPG — max 32MB
                                        </p>
                                    </div>
                                </button>
                            )}
                            {isUploadingImage && (
                                <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                                    <Loader2
                                        size={12}
                                        className="animate-spin"
                                    />{' '}
                                    Uploading...
                                </div>
                            )}
                            {uploadedImageUrl && (
                                <p className="mt-2 text-[11px] font-medium text-[#1a9e52]">
                                    Image uploaded successfully.
                                </p>
                            )}
                        </div>
                    </section>

                    {/* Action buttons */}
                    <div className="flex flex-col-reverse gap-2">
                        <Link
                            href="/inventory"
                            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-center text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
                        >
                            បោះបង់
                        </Link>
                        <button
                            type="submit"
                            disabled={
                                isSubmitting ||
                                loadingLocations ||
                                locations.length === 0
                            }
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1a9e52] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#158042] disabled:opacity-50"
                        >
                            {isSubmitting ? (
                                <Loader2 className="animate-spin" size={16} />
                            ) : null}
                            {isSubmitting ? 'កំពុងរក្សាទុក...' : 'រក្សាទុក'}
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
                                        activeTab === tab.id
                                            ? 'bg-[#1a9e52] text-white'
                                            : 'bg-slate-100 text-slate-500'
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
                                    <Package
                                        size={13}
                                        className="text-[#1a9e52]"
                                    />{' '}
                                    ព័ត៌មានទំនិញ
                                </h3>
                                <div className="grid gap-4 lg:grid-cols-2">
                                    <div>
                                        <FieldLabel>Reference No</FieldLabel>
                                        <ReadonlyInput placeholder="Auto-generated" />
                                    </div>
                                    <div>
                                        <FieldLabel required>
                                            ឈ្មោះទំនិញ
                                        </FieldLabel>
                                        <EditableInput
                                            type="text"
                                            placeholder="ឧ. iPhone 16 Pro Max..."
                                            {...register('name', {
                                                required: 'សូមបញ្ចូលឈ្មោះទំនិញ',
                                            })}
                                        />
                                        {errors.name && (
                                            <p className="mt-1 text-xs text-red-500">
                                                {errors.name.message}
                                            </p>
                                        )}
                                    </div>
                                    <div>
                                        <FieldLabel>ម៉ាក (Brand)</FieldLabel>
                                        <EditableInput
                                            type="text"
                                            placeholder="ឧ. Apple, Samsung..."
                                            {...register('brand')}
                                        />
                                    </div>
                                    <div>
                                        <FieldLabel>
                                            ស្ថានភាពទំនិញ (Condition)
                                        </FieldLabel>
                                        <Controller
                                            name="condition"
                                            control={control}
                                            render={({ field }) => (
                                                <ConditionSelector
                                                    value={field.value ?? 'new'}
                                                    onChange={field.onChange}
                                                />
                                            )}
                                        />
                                    </div>
                                    <div>
                                        <Controller
                                            name="category_id"
                                            control={control}
                                            rules={{
                                                required: 'សូមជ្រើសរើសប្រភេទ',
                                            }}
                                            render={({ field }) => (
                                                <AsyncSearchSelect
                                                    label="ប្រភេទ"
                                                    placeholder="ជ្រើសរើសប្រភេទ..."
                                                    apiUrl="/api/category"
                                                    value={field.value}
                                                    selectedLabel={
                                                        watch('category')
                                                            ?.name ?? ''
                                                    }
                                                    popupTitle="ប្រភេទ"
                                                    enablePopupSearch
                                                    onChange={(selected) => {
                                                        field.onChange(
                                                            selected?.id
                                                                ? Number(
                                                                      selected.id,
                                                                  )
                                                                : null,
                                                        );
                                                        setValue('category', {
                                                            id: selected?.id
                                                                ? Number(
                                                                      selected.id,
                                                                  )
                                                                : null,
                                                            name:
                                                                selected?.name ??
                                                                '',
                                                        });
                                                    }}
                                                    required
                                                />
                                            )}
                                        />
                                        {errors.category_id && (
                                            <p className="mt-1 text-xs text-red-500">
                                                {errors.category_id.message}
                                            </p>
                                        )}
                                    </div>
                                    <div>
                                        <Controller
                                            name="uom_id"
                                            control={control}
                                            rules={{
                                                required: 'សូមជ្រើសរើស UOM',
                                            }}
                                            render={({ field }) => (
                                                <AsyncSearchSelect
                                                    label="Default UOM"
                                                    placeholder="ជ្រើសរើស UOM..."
                                                    apiUrl="/api/uom"
                                                    value={field.value}
                                                    selectedLabel={
                                                        watch('uom')?.name ?? ''
                                                    }
                                                    popupTitle="Default UOM"
                                                    enablePopupSearch
                                                    onChange={(selected) => {
                                                        field.onChange(
                                                            selected?.id
                                                                ? Number(
                                                                      selected.id,
                                                                  )
                                                                : null,
                                                        );
                                                        setValue('uom', {
                                                            id: selected?.id
                                                                ? Number(
                                                                      selected.id,
                                                                  )
                                                                : null,
                                                            name:
                                                                selected?.name ??
                                                                '',
                                                        });
                                                    }}
                                                    required
                                                />
                                            )}
                                        />
                                        {errors.uom_id && (
                                            <p className="mt-1 text-xs text-red-500">
                                                {errors.uom_id.message}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="mt-2">
                                    <FieldLabel>
                                        កំណត់ចំណាំ (Additional Notes)
                                    </FieldLabel>
                                    <EditableTextarea
                                        placeholder="ព័ត៌មានបន្ថែម ឧ. ពណ៌ ទំហំផ្ទុក spec ពិសេស..."
                                        rows={4}
                                        {...register('description')}
                                    />
                                </div>
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div>
                                        <Controller
                                            name="uom_id"
                                            control={control}
                                            rules={{
                                                required: 'Warehouse',
                                            }}
                                            render={({ field }) => (
                                                <AsyncSearchSelect
                                                    label="Warehouse"
                                                    placeholder="ជ្រើសរើស Warehouse..."
                                                    apiUrl="/api/uom"
                                                    value={field.value}
                                                    selectedLabel={
                                                        watch('uom')?.name ?? ''
                                                    }
                                                    popupTitle="Warehouse"
                                                    enablePopupSearch
                                                    onChange={(selected) => {
                                                        field.onChange(
                                                            selected?.id
                                                                ? Number(
                                                                      selected.id,
                                                                  )
                                                                : null,
                                                        );
                                                        setValue('uom', {
                                                            id: selected?.id
                                                                ? Number(
                                                                      selected.id,
                                                                  )
                                                                : null,
                                                            name:
                                                                selected?.name ??
                                                                '',
                                                        });
                                                    }}
                                                    required
                                                />
                                            )}
                                        />
                                        {errors.uom_id && (
                                            <p className="mt-1 text-xs text-red-500">
                                                {errors.uom_id.message}
                                            </p>
                                        )}
                                    </div>
                                    <div>
                                        <Controller
                                            name="uom_id"
                                            control={control}
                                            rules={{
                                                required: 'សូមជ្រើសរើស UOM',
                                            }}
                                            render={({ field }) => (
                                                <AsyncSearchSelect
                                                    label="Location"
                                                    placeholder="ជ្រើសរើស Location..."
                                                    apiUrl="/api/uom"
                                                    value={field.value}
                                                    selectedLabel={
                                                        watch('uom')?.name ?? ''
                                                    }
                                                    popupTitle="Location"
                                                    enablePopupSearch
                                                    onChange={(selected) => {
                                                        field.onChange(
                                                            selected?.id
                                                                ? Number(
                                                                      selected.id,
                                                                  )
                                                                : null,
                                                        );
                                                        setValue('uom', {
                                                            id: selected?.id
                                                                ? Number(
                                                                      selected.id,
                                                                  )
                                                                : null,
                                                            name:
                                                                selected?.name ??
                                                                '',
                                                        });
                                                    }}
                                                    required
                                                />
                                            )}
                                        />
                                        {errors.uom_id && (
                                            <p className="mt-1 text-xs text-red-500">
                                                {errors.uom_id.message}
                                            </p>
                                        )}
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
                                    <Tag size={13} className="text-[#1a9e52]" />{' '}
                                    តម្លៃ
                                </h3>
                                <div className="grid gap-4 sm:grid-cols-3">
                                    <div>
                                        <FieldLabel>
                                            តម្លៃទិញចូល / Cost ($)
                                        </FieldLabel>
                                        <EditableInput
                                            type="number"
                                            min={0}
                                            step="0.01"
                                            {...register('purchase_price', {
                                                valueAsNumber: true,
                                                min: {
                                                    value: 0,
                                                    message: 'Must be ≥ 0',
                                                },
                                            })}
                                        />
                                    </div>
                                    <div>
                                        <FieldLabel required>
                                            តម្លៃលក់ / Sale Price ($)
                                        </FieldLabel>
                                        <EditableInput
                                            type="number"
                                            min={0}
                                            step="0.01"
                                            {...register('sale_price', {
                                                valueAsNumber: true,
                                                required: 'សូមបញ្ចូលតម្លៃលក់',
                                                min: {
                                                    value: 0,
                                                    message: 'Must be ≥ 0',
                                                },
                                            })}
                                        />
                                        {errors.sale_price && (
                                            <p className="mt-1 text-xs text-red-500">
                                                {errors.sale_price.message}
                                            </p>
                                        )}
                                    </div>
                                    <div>
                                        <FieldLabel>
                                            ប្រាក់ចំណេញ (Profit)
                                        </FieldLabel>
                                        <div
                                            className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold ${
                                                profit > 0
                                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                                    : profit < 0
                                                      ? 'border-red-200 bg-red-50 text-red-600'
                                                      : 'border-slate-200 bg-slate-50 text-slate-500'
                                            }`}
                                        >
                                            <BarChart3 size={14} />$
                                            {profit.toFixed(2)}{' '}
                                            <span className="text-xs font-normal opacity-70">
                                                ({profitMargin}%)
                                            </span>
                                        </div>
                                    </div>
                                    <div>
                                        <FieldLabel>
                                            តម្លៃអប្បបរមា (Min Price)
                                        </FieldLabel>
                                        <EditableInput
                                            type="number"
                                            min={0}
                                            step="0.01"
                                            placeholder="ឧ. 0.00"
                                            {...register('min_price', {
                                                setValueAs: (v) =>
                                                    v === '' ? null : Number(v),
                                            })}
                                        />
                                        <p className="mt-1 text-[10px] text-slate-400">
                                            តម្លៃទាបបំផុតដែលអាចលក់
                                        </p>
                                    </div>
                                    <div>
                                        <FieldLabel>
                                            តម្លៃអតិបរមា (Max Price)
                                        </FieldLabel>
                                        <EditableInput
                                            type="number"
                                            min={0}
                                            step="0.01"
                                            placeholder="ឧ. 999.00"
                                            {...register('max_price', {
                                                setValueAs: (v) =>
                                                    v === '' ? null : Number(v),
                                            })}
                                        />
                                        <p className="mt-1 text-[10px] text-slate-400">
                                            តម្លៃខ្ពស់បំផុតដែលអាចលក់
                                        </p>
                                    </div>
                                </div>
                            </section>

                            <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                                <h3 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                                    <Truck
                                        size={13}
                                        className="text-[#1a9e52]"
                                    />{' '}
                                    ស្តុក និងទីតាំង
                                </h3>
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div>
                                        <FieldLabel>
                                            ស្តុកដំបូង (Initial Stock)
                                        </FieldLabel>
                                        <EditableInput
                                            type="number"
                                            min={0}
                                            step={1}
                                            placeholder="0"
                                            {...register('initial_quantity', {
                                                setValueAs: (v) =>
                                                    v === '' ? '' : Number(v),
                                                min: {
                                                    value: 0,
                                                    message: 'Must be ≥ 0',
                                                },
                                            })}
                                        />
                                    </div>
                                    <div>
                                        <FieldLabel>
                                            ចំនួនអប្បបរមា (Min Stock)
                                        </FieldLabel>
                                        <EditableInput
                                            type="number"
                                            min={0}
                                            step={1}
                                            placeholder="ឧ. 5"
                                            {...register('min_stock', {
                                                setValueAs: (v) =>
                                                    v === '' ? null : Number(v),
                                            })}
                                        />
                                        <p className="mt-1 text-[10px] text-slate-400">
                                            ជូនដំណឹងពេលស្តុកទាបជាងចំនួននេះ
                                        </p>
                                    </div>
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
                                    <ShieldCheck
                                        size={13}
                                        className="text-[#1a9e52]"
                                    />{' '}
                                    លក្ខណៈសម្បត្តិទំនិញ
                                </h3>
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <Controller
                                        name="has_warranty"
                                        control={control}
                                        render={({ field }) => (
                                            <ToggleCheckbox
                                                checked={field.value ?? false}
                                                onChange={field.onChange}
                                                icon={<ShieldCheck size={16} />}
                                                label="មានធានា (Warranty)"
                                                description="ជ្រើសរើស warranty period ពេលលក់ចេញ"
                                            />
                                        )}
                                    />
                                    <Controller
                                        name="is_discount"
                                        control={control}
                                        render={({ field }) => (
                                            <ToggleCheckbox
                                                checked={field.value ?? false}
                                                onChange={field.onChange}
                                                icon={<Percent size={16} />}
                                                label="អាចបញ្ចុះតម្លៃ (Discountable)"
                                                description="អនុញ្ញាតអោយដាក់បញ្ចុះតម្លៃពេលលក់"
                                            />
                                        )}
                                    />
                                    <Controller
                                        name="is_returnable"
                                        control={control}
                                        render={({ field }) => (
                                            <ToggleCheckbox
                                                checked={field.value ?? false}
                                                onChange={field.onChange}
                                                icon={<RotateCcw size={16} />}
                                                label="អាចប្តូរវិញ (Returnable)"
                                                description="អនុញ្ញាតអោយអតិថិជនប្តូរវិញ"
                                            />
                                        )}
                                    />
                                    <Controller
                                        name="is_sellable"
                                        control={control}
                                        render={({ field }) => (
                                            <ToggleCheckbox
                                                checked={field.value ?? false}
                                                onChange={field.onChange}
                                                icon={<Tag size={16} />}
                                                label="អាចលក់បាន (Sellable)"
                                                description="បង្ហាញក្នុង POS សម្រាប់លក់ចេញ"
                                            />
                                        )}
                                    />
                                </div>
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
        </div>
    );
}
