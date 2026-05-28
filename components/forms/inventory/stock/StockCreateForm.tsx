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
    MapPin,
    Package,
    Rows3,
    Upload,
    X,
    ShieldCheck,
    Percent,
    RotateCcw,
    Tag,
    Truck,
    BarChart3,
    ScanBarcode,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

// ─── Toggle Checkbox Component ────────────────────────────────────────────────
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
                    <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                    >
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

    const [isSaving, setIsSaving] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [imagePreviewUrl, setImagePreviewUrl] = useState<string>('');
    const [error, setError] = useState('');
    const [locations, setLocations] = useState<StockLocationProps[]>([]);
    const [locationId, setLocationId] = useState<number | ''>('');
    const [initialQuantity, setInitialQuantity] = useState<number | ''>(0);
    const [loadingLocations, setLoadingLocations] = useState(true);

    const [formData, setFormData] = useState<
        InventoryItemProps & {
            condition: string;
            brand: string;
            supplier: string;
            barcode: string;
            min_stock: number | '';
            has_warranty: boolean;
            is_discountable: boolean;
            is_returnable: boolean;
            is_sellable: boolean;
        }
    >({
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
        // ── New fields ──
        condition: 'new',
        brand: '',
        supplier: '',
        barcode: '',
        min_stock: '',
        has_warranty: false,
        is_discountable: true,
        is_returnable: false,
        is_sellable: true,
    });

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        let cancelled = false;

        async function loadLocations() {
            try {
                const res = await fetch('/api/stock-location');
                const json = await res.json();
                if (!res.ok) {
                    throw new Error(
                        json.error ?? 'Failed to load stock locations',
                    );
                }

                const data: StockLocationProps[] = json.data ?? [];
                if (cancelled) return;

                setLocations(data);
                const defaultLocation =
                    data.find((location) => location.is_default) ?? data[0];
                if (defaultLocation) setLocationId(defaultLocation.id);
            } catch (err) {
                if (!cancelled) {
                    setError(
                        err instanceof Error
                            ? err.message
                            : 'Failed to load stock locations',
                    );
                }
            } finally {
                if (!cancelled) setLoadingLocations(false);
            }
        }

        loadLocations();
        return () => {
            cancelled = true;
        };
    }, []);

    const handleChange = (
        e: React.ChangeEvent<
            HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
        >,
    ) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]:
                name === 'purchase_price' || name === 'sale_price'
                    ? Number(value)
                    : value,
        }));
    };

    const handleCategoryChange = (
        selected: { id: string | number | null; name: string } | null,
    ) => {
        setFormData((prev) => ({
            ...prev,
            category_id: selected?.id ? Number(selected.id) : null,
            category: {
                id: selected?.id ? Number(selected.id) : null,
                name: selected?.name ?? '',
            },
        }));
    };

    const handleUomChange = (
        selected: { id: string | number | null; name: string } | null,
    ) => {
        setFormData((prev) => ({
            ...prev,
            uom_id: selected?.id ? Number(selected.id) : null,
            uom: {
                id: selected?.id ? Number(selected.id) : null,
                name: selected?.name ?? '',
            },
        }));
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 32 * 1024 * 1024) {
            setError('សូមជ្រើសរើសរូបភាពដែលមានទំហំតូចជាង 32MB');
            return;
        }

        setError('');
        setSelectedFile(file);
        setImagePreviewUrl(URL.createObjectURL(file));
    };

    const removeImage = () => {
        setImagePreviewUrl('');
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const triggerFileInput = () => {
        fileInputRef.current?.click();
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        const quantity =
            initialQuantity === '' ? 0 : Number(initialQuantity);
        if (Number.isNaN(quantity) || quantity < 0) {
            setError('សូមបញ្ចូលចំនួនស្តុកដំបូងត្រឹមត្រូវ។');
            return;
        }
        if (loadingLocations) {
            setError('កំពុងទាញយកទីតាំងស្តុក។ សូមរង់ចាំបន្តិច។');
            return;
        }
        if (locations.length === 0) {
            setError(
                'មិនមានទីតាំងស្តុក។ សូមបង្កើត Storage Location ជាមុនសិន',
            );
            return;
        }
        if (!locationId) {
            setError('សូមជ្រើសរើសទីតាំងស្តុក។');
            return;
        }

        setIsSaving(true);

        try {
            let uploadedImageUrl = '';

            if (selectedFile) {
                const imgFormData = new FormData();
                imgFormData.append('image', selectedFile);

                const imgbbApiKey = process.env.NEXT_PUBLIC_IMGBB_API_KEY;
                if (!imgbbApiKey) {
                    throw new Error(
                        'រកមិនឃើញ ImgBB API Key! សូមត្រួតពិនិត្យឯកសារ .env.local របស់អ្នក។',
                    );
                }

                const imgResponse = await fetch(
                    `https://api.imgbb.com/1/upload?key=${imgbbApiKey}`,
                    { method: 'POST', body: imgFormData },
                );

                const imgData = await imgResponse.json();
                if (!imgData.success) {
                    throw new Error(
                        'បរាជ័យក្នុងការ Upload រូបភាពទៅកាន់ ImgBB',
                    );
                }

                uploadedImageUrl = imgData.data.url;
            }

            const payload = {
                name: formData.name,
                item_class: formData.item_class,
                reference_no: formData.reference_no,
                purchase_price: formData.purchase_price,
                sale_price: formData.sale_price,
                description: formData.description,
                category_id: formData.category_id,
                uom_id: formData.uom_id,
                images_url: uploadedImageUrl ? [uploadedImageUrl] : [],
                price: formData.sale_price,
                stock: 0,
                // ── New fields in payload ──
                condition: formData.condition,
                brand: formData.brand || null,
                supplier: formData.supplier || null,
                barcode: formData.barcode || null,
                min_stock: formData.min_stock === '' ? null : Number(formData.min_stock),
                has_warranty: formData.has_warranty,
                is_discountable: formData.is_discountable,
                is_returnable: formData.is_returnable,
                is_sellable: formData.is_sellable,
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

            const data = await response.json();
            const newItemId = data.data?.id;

            if (quantity > 0 && newItemId) {
                const stockResponse = await fetch(
                    `/api/inventory/${newItemId}/adjust`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            received_quantity: quantity,
                            adjustment_reason: 'Initial stock',
                            location_id: locationId,
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
                `/inventory/stock/${data.data.id}/view?create_success=${true}&stock=${true}`,
            );
            router.refresh();
        } catch (error: unknown) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'មានបញ្ហាក្នុងការរក្សាទុកទិន្នន័យទៅកាន់ Database!';
            setError(message);
        } finally {
            setIsSaving(false);
        }
    };

    // ── Profit calculation ──
    const profit = Number(formData.sale_price) - Number(formData.purchase_price);
    const profitMargin =
        Number(formData.sale_price) > 0
            ? ((profit / Number(formData.sale_price)) * 100).toFixed(1)
            : '0.0';

    return (
        <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
            {/* Header */}
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <Link
                        href="/inventory"
                        className="inline-flex items-center gap-2 text-sm text-slate-500 transition-colors hover:text-slate-700"
                    >
                        <ArrowLeft size={16} />
                        ត្រឡប់ទៅឃ្លាំងទំនិញ
                    </Link>
                    <h2 className="mt-3 flex items-center gap-2 text-2xl font-bold text-slate-800 md:text-3xl">
                        <Package className="text-[#1a9e52]" />
                        បន្ថែមទំនិញថ្មី
                    </h2>
                    <p className="mt-2 text-sm text-slate-500">
                        បំពេញព័ត៌មានទំនិញ ស្តុក តម្លៃ និង Variant
                        សម្រាប់ប្រើក្នុងប្រព័ន្ធ។
                    </p>
                </div>
            </div>

            {/* ── Global error banner ── */}
            {error && (
                <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                    <AlertCircle
                        size={18}
                        className="mt-0.5 shrink-0 text-red-500"
                    />
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
                {/* ══════════════════════════════════════════════════════════════
                    LEFT COLUMN — Main form (wider now)
                   ══════════════════════════════════════════════════════════════ */}
                <div className="space-y-6">
                    {/* ── Section 1: Basic Information ── */}
                    <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                        <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-500">
                            <Package size={15} className="text-[#1a9e52]" />
                            ព័ត៌មានទំនិញ
                        </h3>

                        <div className="grid gap-4 lg:grid-cols-2">
                            {/* Reference No */}
                            <div>
                                <FieldLabel>Reference No</FieldLabel>
                                <ReadonlyInput placeholder="Auto-generated" />
                            </div>

                            {/* Item Name */}
                            <div>
                                <FieldLabel required>ឈ្មោះទំនិញ</FieldLabel>
                                <EditableInput
                                    type="text"
                                    name="name"
                                    required
                                    value={formData.name}
                                    onChange={handleChange}
                                    placeholder="ឧ. iPhone 16 Pro Max, Samsung S24..."
                                />
                            </div>

                            {/* Brand */}
                            <div>
                                <FieldLabel>ម៉ាក (Brand)</FieldLabel>
                                <EditableInput
                                    type="text"
                                    name="brand"
                                    value={formData.brand}
                                    onChange={handleChange}
                                    placeholder="ឧ. Apple, Samsung, Xiaomi..."
                                />
                            </div>

                            {/* Condition */}
                            <div>
                                <FieldLabel>ស្ថានភាពទំនិញ (Condition)</FieldLabel>
                                <ConditionSelector
                                    value={formData.condition}
                                    onChange={(val) =>
                                        setFormData((prev) => ({
                                            ...prev,
                                            condition: val,
                                        }))
                                    }
                                />
                            </div>

                            {/* Category */}
                            <div>
                                <AsyncSearchSelect
                                    label="ប្រភេទ"
                                    placeholder="ជ្រើសរើសប្រភេទ..."
                                    apiUrl="/api/category"
                                    value={formData.category?.name ?? ''}
                                    onChange={handleCategoryChange}
                                    required
                                />
                            </div>

                            {/* UOM */}
                            <div>
                                <AsyncSearchSelect
                                    label="Unit of Measurement"
                                    placeholder="ជ្រើសរើស UOM..."
                                    apiUrl="/api/uom"
                                    value={formData.uom?.name ?? ''}
                                    onChange={handleUomChange}
                                    required
                                />
                            </div>

                            {/* Barcode */}
                            <div>
                                <FieldLabel>Barcode / SKU</FieldLabel>
                                <div className="relative">
                                    <EditableInput
                                        type="text"
                                        name="barcode"
                                        value={formData.barcode}
                                        onChange={handleChange}
                                        placeholder="Scan or type barcode..."
                                    />
                                    <ScanBarcode
                                        size={16}
                                        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-300"
                                    />
                                </div>
                            </div>

                            {/* Supplier */}
                            <div>
                                <FieldLabel>អ្នកផ្គត់ផ្គង់ (Supplier)</FieldLabel>
                                <EditableInput
                                    type="text"
                                    name="supplier"
                                    value={formData.supplier}
                                    onChange={handleChange}
                                    placeholder="ឈ្មោះអ្នកផ្គត់ផ្គង់..."
                                />
                            </div>
                        </div>
                    </section>

                    {/* ── Section 2: Pricing ── */}
                    <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                        <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-500">
                            <Tag size={15} className="text-[#1a9e52]" />
                            តម្លៃ
                        </h3>

                        <div className="grid gap-4 sm:grid-cols-3">
                            <div>
                                <FieldLabel>តម្លៃទិញចូល ($)</FieldLabel>
                                <EditableInput
                                    name="purchase_price"
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={formData.purchase_price}
                                    onChange={handleChange}
                                />
                            </div>
                            <div>
                                <FieldLabel required>តម្លៃលក់ ($)</FieldLabel>
                                <EditableInput
                                    name="sale_price"
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={formData.sale_price}
                                    onChange={handleChange}
                                />
                            </div>
                            {/* Profit indicator */}
                            <div>
                                <FieldLabel>ប្រាក់ចំណេញ (Profit)</FieldLabel>
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
                        </div>
                    </section>

                    {/* ── Section 3: Stock & Location ── */}
                    <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                        <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-500">
                            <Truck size={15} className="text-[#1a9e52]" />
                            ស្តុក និងទីតាំង
                        </h3>

                        <div className="grid gap-4 sm:grid-cols-3">
                            <div>
                                <FieldLabel>ស្តុកដំបូង (Initial Stock)</FieldLabel>
                                <EditableInput
                                    type="number"
                                    min={0}
                                    step={1}
                                    value={initialQuantity}
                                    onChange={(e) =>
                                        setInitialQuantity(
                                            e.target.value === ''
                                                ? ''
                                                : Number(e.target.value),
                                        )
                                    }
                                    placeholder="0"
                                />
                            </div>

                            <div>
                                <FieldLabel>ចំនួនអប្បបរមា (Min Stock Alert)</FieldLabel>
                                <EditableInput
                                    type="number"
                                    min={0}
                                    step={1}
                                    value={formData.min_stock}
                                    onChange={(e) =>
                                        setFormData((prev) => ({
                                            ...prev,
                                            min_stock:
                                                e.target.value === ''
                                                    ? ''
                                                    : Number(e.target.value),
                                        }))
                                    }
                                    placeholder="ឧ. 5"
                                />
                                <p className="mt-1 text-[10px] text-slate-400">
                                    ជូនដំណឹងពេលស្តុកទាបជាងចំនួននេះ
                                </p>
                            </div>

                            <div>
                                <FieldLabel>ទីតាំងស្តុក (Location) *</FieldLabel>
                                <select
                                    value={locationId}
                                    onChange={(e) =>
                                        setLocationId(
                                            Number(e.target.value) || '',
                                        )
                                    }
                                    disabled={
                                        loadingLocations ||
                                        locations.length === 0
                                    }
                                    required
                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <option value="">
                                        {loadingLocations
                                            ? 'កំពុងទាញយកទីតាំង...'
                                            : 'ជ្រើសរើសទីតាំង...'}
                                    </option>
                                    {locations.map((location) => (
                                        <option
                                            key={location.id}
                                            value={location.id}
                                        >
                                            {location.code
                                                ? `[${location.code}] `
                                                : ''}
                                            {location.name}
                                            {location.is_default
                                                ? ' (Default)'
                                                : ''}
                                        </option>
                                    ))}
                                </select>
                                {!loadingLocations &&
                                    locations.length === 0 && (
                                        <p className="mt-2 flex items-start gap-2 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                                            <AlertCircle
                                                size={14}
                                                className="mt-0.5 shrink-0"
                                            />
                                            មិនមានទីតាំងស្តុក។ សូមបង្កើត
                                            Storage Location ជាមុនសិន
                                        </p>
                                    )}
                            </div>
                        </div>
                    </section>

                    {/* ── Section 4: Item Properties (Checkboxes) ── */}
                    <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                        <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-500">
                            <ShieldCheck
                                size={15}
                                className="text-[#1a9e52]"
                            />
                            លក្ខណៈសម្បត្តិទំនិញ
                        </h3>

                        <div className="grid gap-3 sm:grid-cols-2">
                            <ToggleCheckbox
                                checked={formData.has_warranty}
                                onChange={(val) =>
                                    setFormData((prev) => ({
                                        ...prev,
                                        has_warranty: val,
                                    }))
                                }
                                icon={<ShieldCheck size={16} />}
                                label="មានធានា (Warranty)"
                                description="ជ្រើសរើស warranty period ពេលលក់ចេញ"
                            />
                            <ToggleCheckbox
                                checked={formData.is_discountable}
                                onChange={(val) =>
                                    setFormData((prev) => ({
                                        ...prev,
                                        is_discountable: val,
                                    }))
                                }
                                icon={<Percent size={16} />}
                                label="អាចបញ្ចុះតម្លៃ (Discountable)"
                                description="អនុញ្ញាតអោយដាក់បញ្ចុះតម្លៃពេលលក់"
                            />
                            <ToggleCheckbox
                                checked={formData.is_returnable}
                                onChange={(val) =>
                                    setFormData((prev) => ({
                                        ...prev,
                                        is_returnable: val,
                                    }))
                                }
                                icon={<RotateCcw size={16} />}
                                label="អាចប្តូរវិញ (Returnable)"
                                description="អនុញ្ញាតអោយអតិថិជនប្តូរវិញ"
                            />
                            <ToggleCheckbox
                                checked={formData.is_sellable}
                                onChange={(val) =>
                                    setFormData((prev) => ({
                                        ...prev,
                                        is_sellable: val,
                                    }))
                                }
                                icon={<Tag size={16} />}
                                label="អាចលក់បាន (Sellable)"
                                description="បង្ហាញក្នុង POS សម្រាប់លក់ចេញ"
                            />
                        </div>
                    </section>

                    {/* ── Section 5: Notes ── */}
                    <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                        <FieldLabel>កំណត់ចំណាំ (Additional Notes)</FieldLabel>
                        <EditableTextarea
                            name="description"
                            value={formData.description ?? ''}
                            onChange={handleChange}
                            placeholder="ព័ត៌មានបន្ថែម ឧ. ពណ៌ ទំហំផ្ទុក spec ពិសេស..."
                            rows={3}
                        />
                    </section>
                </div>

                {/* ══════════════════════════════════════════════════════════════
                    RIGHT SIDEBAR — Image + Summary (narrower: 280px)
                   ══════════════════════════════════════════════════════════════ */}
                <aside className="space-y-5">
                    {/* Image upload — compact */}
                    <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                        <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                            <Rows3 size={14} className="text-[#1a9e52]" />
                            រូបភាព
                        </div>

                        <div
                            className={`cursor-pointer rounded-xl border-2 border-dashed p-3 text-center transition-all ${
                                imagePreviewUrl
                                    ? 'border-[#1a9e52]/50 bg-[#1a9e52]/5'
                                    : 'border-slate-300 hover:border-[#1a9e52] hover:bg-slate-50'
                            }`}
                            onClick={
                                !imagePreviewUrl ? triggerFileInput : undefined
                            }
                        >
                            <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                ref={fileInputRef}
                                onChange={handleImageUpload}
                            />

                            {imagePreviewUrl ? (
                                <div className="relative inline-block">
                                    <Image
                                        src={imagePreviewUrl}
                                        alt="Preview"
                                        width={240}
                                        height={160}
                                        unoptimized
                                        className="h-36 w-auto rounded-lg object-contain shadow-sm"
                                    />
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            removeImage();
                                        }}
                                        className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white shadow-md hover:bg-red-600"
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-6 text-slate-500">
                                    <div className="mb-2 rounded-full bg-slate-100 p-2.5">
                                        <Upload
                                            size={18}
                                            className="text-slate-400"
                                        />
                                    </div>
                                    <p className="text-xs font-medium">
                                        ចុចដើម្បីជ្រើសរើសរូបភាព
                                    </p>
                                    <p className="mt-0.5 text-[10px] text-slate-400">
                                        PNG, JPG — មិនលើស 32MB
                                    </p>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Summary — compact */}
                    <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                        <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
                            សង្ខេប
                        </h3>
                        <div className="space-y-1.5 text-xs text-slate-600">
                            {[
                                {
                                    label: 'Category',
                                    value: formData.category?.name,
                                },
                                {
                                    label: 'UOM',
                                    value: formData.uom?.name,
                                },
                                { label: 'Brand', value: formData.brand },
                                {
                                    label: 'Condition',
                                    value:
                                        formData.condition === 'new'
                                            ? 'ថ្មី'
                                            : formData.condition === 'used'
                                              ? 'មួយទឹក'
                                              : 'Refurbished',
                                },
                                {
                                    label: 'Purchase',
                                    value: `$${Number(formData.purchase_price).toFixed(2)}`,
                                },
                                {
                                    label: 'Sale',
                                    value: `$${Number(formData.sale_price).toFixed(2)}`,
                                },
                                {
                                    label: 'Profit',
                                    value: `$${profit.toFixed(2)} (${profitMargin}%)`,
                                },
                                {
                                    label: 'Stock',
                                    value: String(initialQuantity || 0),
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

                            <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
                                <span className="flex items-center gap-1 text-slate-500">
                                    <MapPin size={11} />
                                    Location
                                </span>
                                <span className="truncate text-right font-semibold text-slate-800">
                                    {locations.find(
                                        (location) =>
                                            location.id === locationId,
                                    )?.name ?? '-'}
                                </span>
                            </div>
                        </div>

                        {/* Toggle badges summary */}
                        <div className="mt-3 flex flex-wrap gap-1.5">
                            {formData.has_warranty && (
                                <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-600">
                                    <ShieldCheck size={10} /> Warranty
                                </span>
                            )}
                            {formData.is_discountable && (
                                <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-0.5 text-[10px] font-semibold text-purple-600">
                                    <Percent size={10} /> Discount
                                </span>
                            )}
                            {formData.is_returnable && (
                                <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-600">
                                    <RotateCcw size={10} /> Return
                                </span>
                            )}
                            {formData.is_sellable && (
                                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                                    <Tag size={10} /> Sellable
                                </span>
                            )}
                        </div>

                        {/* Buttons */}
                        <div className="mt-5 flex flex-col-reverse gap-2">
                            <Link
                                href="/inventory"
                                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-center text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
                            >
                                បោះបង់
                            </Link>
                            <button
                                type="submit"
                                disabled={
                                    isSaving ||
                                    loadingLocations ||
                                    locations.length === 0
                                }
                                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1a9e52] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#158042] disabled:opacity-50"
                            >
                                {isSaving ? (
                                    <Loader2
                                        className="animate-spin"
                                        size={16}
                                    />
                                ) : null}
                                {isSaving ? 'កំពុងរក្សាទុក...' : 'រក្សាទុក'}
                            </button>
                        </div>
                    </section>
                </aside>
            </form>
        </div>
    );
}