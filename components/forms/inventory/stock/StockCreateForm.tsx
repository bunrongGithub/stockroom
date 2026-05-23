'use client';

import AsyncSearchSelect from '@/components/ui/AsyncSearchSelect';
import {
    EditableInput,
    EditableTextarea,
    FieldLabel,
} from '@/components/ui/FieldLabel';
import { ReadonlyInput } from '@/components/ui/Readonly';
import { InventoryItemProps } from '@/types/inventory/item';
import { uploadImage } from '@/utils/utils';
import {
    AlertCircle,
    ArrowLeft,
    Loader2,
    Package,
    Rows3,
    Upload,
    X,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

type PriceFieldName = 'purchase_price' | 'sale_price';

const IMAGE_MAX_SIZE = 32 * 1024 * 1024;

function normalizePriceInput(rawValue: string) {
    const sanitized = rawValue.replace(/[^\d.]/g, '');
    const [integerPart, ...decimalParts] = sanitized.split('.');
    const decimalPart = decimalParts.join('').slice(0, 2);

    if (sanitized.startsWith('.')) {
        return decimalPart ? `0.${decimalPart}` : '0.';
    }

    if (decimalParts.length === 0) {
        return integerPart;
    }

    return `${integerPart}.${decimalPart}`;
}

export default function StockCreateForm() {
    const router = useRouter();

    const [isSaving, setIsSaving] = useState(false);
    const [isUploadingImage, setIsUploadingImage] = useState(false);
    const [imagePreviewUrl, setImagePreviewUrl] = useState<string>('');
    const [uploadedImageUrl, setUploadedImageUrl] = useState<string>('');
    const [error, setError] = useState('');
    const [priceInputs, setPriceInputs] = useState({
        purchase_price: '',
        sale_price: '',
    });

    const [formData, setFormData] = useState<InventoryItemProps>({
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
        category: {
            id: null,
            name: '',
        },
        uom_id: null,
        uom: {
            id: null,
            name: '',
        },
        images_url: [],
    });

    const fileInputRef = useRef<HTMLInputElement>(null);
    const previewUrlRef = useRef<string>('');

    const setPreviewUrl = (nextPreviewUrl: string) => {
        if (previewUrlRef.current) {
            URL.revokeObjectURL(previewUrlRef.current);
        }

        previewUrlRef.current = nextPreviewUrl;
        setImagePreviewUrl(nextPreviewUrl);
    };

    useEffect(() => {
        return () => {
            if (previewUrlRef.current) {
                URL.revokeObjectURL(previewUrlRef.current);
            }
        };
    }, []);

    // Generic handler for text/number inputs
    const handleChange = (
        e: React.ChangeEvent<
            HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
        >,
    ) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    const handlePriceChange =
        (field: PriceFieldName) =>
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const nextValue = normalizePriceInput(e.target.value);

            setPriceInputs((prev) => ({
                ...prev,
                [field]: nextValue,
            }));

            setFormData((prev) => ({
                ...prev,
                [field]:
                    nextValue === '' || nextValue === '0.'
                        ? 0
                        : Number(nextValue),
            }));
        };

    const handlePriceBlur = (field: PriceFieldName) => {
        setPriceInputs((prev) => ({
            ...prev,
            [field]:
                prev[field] === ''
                    ? ''
                    : Number(formData[field] ?? 0).toFixed(2),
        }));
    };

    // Handler for category AsyncSearchSelect
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

    // Handler for UOM AsyncSearchSelect
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

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > IMAGE_MAX_SIZE) {
            setError('សូមជ្រើសរើសរូបភាពដែលមានទំហំតូចជាង 32MB');
            return;
        }

        const previewUrl = URL.createObjectURL(file);
        setError('');
        setUploadedImageUrl('');
        setPreviewUrl(previewUrl);
        setIsUploadingImage(true);

        try {
            const imageUrl = await uploadImage(file);
            setUploadedImageUrl(imageUrl);
            setFormData((prev) => ({
                ...prev,
                images_url: [imageUrl],
            }));
        } catch (uploadError) {
            removeImage();
            const message =
                uploadError instanceof Error
                    ? uploadError.message
                    : 'មានបញ្ហាក្នុងការអាប់ឡូតរូបភាព។';
            setError(message);
        } finally {
            setIsUploadingImage(false);
        }
    };

    const removeImage = () => {
        setPreviewUrl('');
        setUploadedImageUrl('');
        setFormData((prev) => ({
            ...prev,
            images_url: [],
        }));
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const triggerFileInput = () => {
        fileInputRef.current?.click();
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsSaving(true);

        try {
            if (isUploadingImage) {
                throw new Error('សូមរង់ចាំរូបភាពអាប់ឡូតរួចសិន។');
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
            };

            const response = await fetch('/api/inventory', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
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
                className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_360px]"
            >
                {/* ── Left column ── */}
                <div className="space-y-6">
                    <section className="rounded-md border border-slate-50">
                        <div className="grid gap-5 lg:grid-cols-2">
                            {/* Reference No — readonly, generated server-side */}
                            <div className="lg:col-span-1">
                                <FieldLabel>Reference No</FieldLabel>
                                <ReadonlyInput placeholder="Auto-generated" />
                            </div>

                            {/* Item Name */}
                            <div className="lg:col-span-1">
                                <FieldLabel>ឈ្មោះទំនិញ</FieldLabel>
                                <EditableInput
                                    type="text"
                                    name="name"
                                    required
                                    value={formData.name}
                                    onChange={handleChange}
                                    placeholder="ឧ. iPhone Case..."
                                />
                            </div>

                            {/* Category */}
                            <div>
                                <AsyncSearchSelect
                                    label="ប្រភេទ"
                                    placeholder="ជ្រើសរើសប្រភេទ..."
                                    apiUrl="/api/category"
                                    value={formData.category_id}
                                    selectedLabel={formData.category?.name ?? ''}
                                    popupTitle="ប្រភេទ"
                                    enablePopupSearch
                                    onChange={handleCategoryChange}
                                    required
                                />
                            </div>

                            {/* UOM */}
                            <div>
                                <AsyncSearchSelect
                                    label="Unit of Measurement"
                                    placeholder="ជ្រើសរើសខ្នាត..."
                                    apiUrl="/api/uom"
                                    value={formData.uom_id}
                                    selectedLabel={formData.uom?.name ?? ''}
                                    popupTitle="Unit of Measurement"
                                    enablePopupSearch
                                    onChange={handleUomChange}
                                    required
                                />
                            </div>

                            {/* Purchase Price */}
                            <div>
                                <FieldLabel>តម្លៃទិញចូល ($)</FieldLabel>
                                <div className="relative">
                                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-400">
                                        $
                                    </span>
                                    <EditableInput
                                        name="purchase_price"
                                        type="text"
                                        inputMode="decimal"
                                        autoComplete="off"
                                        placeholder="0.00"
                                        value={priceInputs.purchase_price}
                                        onChange={handlePriceChange('purchase_price')}
                                        onBlur={() =>
                                            handlePriceBlur('purchase_price')
                                        }
                                        className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-9 pr-4 text-sm text-slate-800 placeholder-slate-300 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                    />
                                </div>
                                <p className="mt-1.5 text-xs text-slate-400">
                                    បញ្ចូលតម្លៃទិញជាទម្រង់ទសភាគ 2 ខ្ទង់
                                </p>
                            </div>

                            {/* Sale Price */}
                            <div>
                                <FieldLabel>តម្លៃលក់ ($)</FieldLabel>
                                <div className="relative">
                                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-400">
                                        $
                                    </span>
                                    <EditableInput
                                        name="sale_price"
                                        type="text"
                                        inputMode="decimal"
                                        autoComplete="off"
                                        placeholder="0.00"
                                        value={priceInputs.sale_price}
                                        onChange={handlePriceChange('sale_price')}
                                        onBlur={() =>
                                            handlePriceBlur('sale_price')
                                        }
                                        className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-9 pr-4 text-sm text-slate-800 placeholder-slate-300 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                    />
                                </div>
                                <p className="mt-1.5 text-xs text-slate-400">
                                    តម្លៃនេះនឹងប្រើសម្រាប់លក់ចេញក្នុងប្រព័ន្ធ
                                </p>
                            </div>

                            {/* Description */}
                            <div className="lg:col-span-2">
                                <FieldLabel>Additional Notes</FieldLabel>
                                <EditableTextarea
                                    name="description"
                                    value={formData.description ?? ''}
                                    onChange={handleChange}
                                    placeholder="Internal notes, usage context, supplier info…"
                                />
                            </div>
                        </div>
                    </section>
                </div>

                {/* ── Right sidebar ── */}
                <aside className="space-y-6">
                    {/* Image upload */}
                    <section>
                        <div className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-800">
                            <Rows3 size={18} className="text-[#1a9e52]" />
                            រូបភាពទំនិញ
                        </div>

                        <div
                            className={`cursor-pointer rounded-2xl border-2 border-dashed p-4 text-center transition-all ${
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
                                        width={320}
                                        height={224}
                                        unoptimized
                                        className="h-56 w-auto rounded-xl object-contain shadow-sm"
                                    />
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            removeImage();
                                        }}
                                        disabled={isUploadingImage}
                                        className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white shadow-md hover:bg-red-600"
                                    >
                                        <X size={14} />
                                    </button>
                                    {isUploadingImage ? (
                                        <div className="absolute inset-x-3 bottom-3 flex items-center justify-center gap-2 rounded-full bg-slate-900/75 px-3 py-2 text-xs font-medium text-white">
                                            <Loader2
                                                size={14}
                                                className="animate-spin"
                                            />
                                            កំពុងអាប់ឡូតរូបភាព...
                                        </div>
                                    ) : null}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-10 text-slate-500">
                                    <div className="mb-3 rounded-full bg-slate-100 p-3">
                                        <Upload
                                            size={24}
                                            className="text-slate-400"
                                        />
                                    </div>
                                    <p className="text-sm font-medium">
                                        ចុចទីនេះ ដើម្បីជ្រើសរើសរូបភាព
                                    </p>
                                    <p className="mt-1 text-xs text-slate-400">
                                        PNG, JPG មិនលើសពី 32MB
                                    </p>
                                </div>
                            )}
                        </div>
                        {uploadedImageUrl ? (
                            <p className="mt-2 text-xs text-[#1a9e52]">
                                រូបភាពត្រូវបានអាប់ឡូតរួចរាល់ ហើយនឹងភ្ជាប់ជាមួយទំនិញនេះ។
                            </p>
                        ) : null}
                    </section>

                    {/* Summary */}
                    <section>
                        <h3 className="text-lg font-semibold text-slate-800">
                            សង្ខេបទិន្នន័យ
                        </h3>
                        <div className="mt-4 space-y-3 text-sm text-slate-600">
                            <div className="flex items-center justify-between gap-4 rounded-2xl bg-white px-4 py-3">
                                <span>Category</span>
                                <span className="font-semibold text-slate-800">
                                    {formData.category?.name || '-'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between gap-4 rounded-2xl bg-white px-4 py-3">
                                <span>UOM</span>
                                <span className="font-semibold uppercase text-slate-800">
                                    {formData.uom?.name || '-'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between gap-4 rounded-2xl bg-white px-4 py-3">
                                <span>Purchase Price</span>
                                <span className="font-semibold text-slate-800">
                                    $
                                    {Number(formData.purchase_price).toFixed(2)}
                                </span>
                            </div>
                            <div className="flex items-center justify-between gap-4 rounded-2xl bg-white px-4 py-3">
                                <span>Sell Price</span>
                                <span className="font-semibold text-slate-800">
                                    ${Number(formData.sale_price).toFixed(2)}
                                </span>
                            </div>
                        </div>

                        <div className="mt-6 flex flex-col-reverse gap-3">
                            <Link
                                href="/inventory"
                                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-center font-medium text-slate-600 transition-colors hover:bg-slate-50"
                            >
                                បោះបង់ (Cancel)
                            </Link>
                            <button
                                type="submit"
                                disabled={isSaving || isUploadingImage}
                                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1a9e52] px-4 py-3 font-medium text-white transition-colors hover:bg-[#158042] disabled:opacity-50"
                            >
                                {isSaving ? (
                                    <Loader2
                                        className="animate-spin"
                                        size={18}
                                    />
                                ) : null}
                                {isSaving
                                    ? 'កំពុងរក្សាទុក...'
                                    : isUploadingImage
                                      ? 'កំពុងរង់ចាំរូបភាព...'
                                    : 'រក្សាទុក (Save)'}
                            </button>
                        </div>
                    </section>
                </aside>
            </form>
        </div>
    );
}
