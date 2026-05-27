'use client';

import AsyncSearchSelect from '@/components/ui/AsyncSearchSelect';
import {
    EditableInput,
    EditableTextarea,
    FieldLabel,
} from '@/components/ui/FieldLabel';
import { ReadonlyInput } from '@/components/ui/Readonly';
import { InventoryItemProps } from '@/types/inventory/item';
import {
    ArrowLeft,
    AlertCircle,
    Loader2,
    Settings,
    Rows3,
    Upload,
    X,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

export default function NoneStockCreateForm() {
    const router = useRouter();

    const [isSaving, setIsSaving] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [imagePreviewUrl, setImagePreviewUrl] = useState<string>('');
    const [error, setError] = useState('');

    const [formData, setFormData] = useState<InventoryItemProps>({
        id: null,
        name: '',
        item_class: 'service',
        reference_no: '',
        purchase_price: 0,
        sale_price: 0,
        labor_cost: 0,
        warranty_duration: '',
        estimated_duration: '',
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

    const handleChange = (
        e: React.ChangeEvent<
            HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
        >,
    ) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]:
                name === 'purchase_price' || name === 'sale_price' || name === 'labor_cost'
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
                    {
                        method: 'POST',
                        body: imgFormData,
                    },
                );

                const imgData = await imgResponse.json();
                if (!imgData.success) {
                    throw new Error('បរាជ័យក្នុងការ Upload រូបភាពទៅកាន់ ImgBB');
                }

                uploadedImageUrl = imgData.data.url;
            }

            const payload = {
                name: formData.name,
                item_class: formData.item_class,
                reference_no: formData.reference_no,
                purchase_price: formData.labor_cost, // Backward compatibility for price
                labor_cost: formData.labor_cost,
                sale_price: formData.sale_price,
                warranty_duration: formData.warranty_duration,
                estimated_duration: formData.estimated_duration,
                description: formData.description,
                category_id: formData.category_id,
                uom_id: formData.uom_id,
                images_url: uploadedImageUrl ? [uploadedImageUrl] : [],
                price: formData.sale_price,
                stock: null,
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
                        'បរាជ័យក្នុងការ​បង្កើតសេវាកម្ម។',
                );
            }

            router.push(`/inventory/none_stock?create_success=${true}`);
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
                        href="/inventory/none_stock"
                        className="inline-flex items-center gap-2 text-sm text-slate-500 transition-colors hover:text-slate-700"
                    >
                        <ArrowLeft size={16} />
                        ត្រឡប់ទៅសេវាកម្ម
                    </Link>
                    <h2 className="mt-3 flex items-center gap-2 text-2xl font-bold text-slate-800 md:text-3xl">
                        <Settings className="text-[#1a9e52]" />
                        បង្កើតសេវាកម្មថ្មី
                    </h2>
                    <p className="mt-2 text-sm text-slate-500">
                        បំពេញព័ត៌មានសេវាកម្មជួសជុល តម្លៃពលកម្ម និងការធានា។
                    </p>
                </div>
            </div>

            {/* Global error banner */}
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
                {/* Left column */}
                <div className="space-y-6">
                    <section className="rounded-md border border-slate-50">
                        <div className="grid gap-5 lg:grid-cols-2">
                            {/* Reference No */}
                            <div className="lg:col-span-1">
                                <FieldLabel>Reference No</FieldLabel>
                                <ReadonlyInput placeholder="Auto-generated" />
                            </div>

                            {/* Service Name */}
                            <div className="lg:col-span-1">
                                <FieldLabel>ឈ្មោះសេវាកម្ម *</FieldLabel>
                                <EditableInput
                                    type="text"
                                    name="name"
                                    required
                                    value={formData.name}
                                    onChange={handleChange}
                                    placeholder="ឧ. ប្តូរអេក្រង់ iPhone 13 Pro"
                                />
                            </div>

                            {/* Category */}
                            <div>
                                <AsyncSearchSelect
                                    label="ប្រភេទសេវាកម្ម"
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
                                    placeholder="ជ្រើសរើសប្រភេទ..."
                                    apiUrl="/api/uom"
                                    value={formData.uom?.name ?? ''}
                                    onChange={handleUomChange}
                                    required
                                />
                            </div>

                            {/* Labor Cost */}
                            <div>
                                <FieldLabel>ថ្លៃពលកម្ម / Base Price ($)</FieldLabel>
                                <EditableInput
                                    name="labor_cost"
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={formData.labor_cost}
                                    onChange={handleChange}
                                />
                            </div>

                            {/* Sale Price */}
                            <div>
                                <FieldLabel>តម្លៃសរុប Sale Price ($) *</FieldLabel>
                                <EditableInput
                                    name="sale_price"
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    required
                                    value={formData.sale_price}
                                    onChange={handleChange}
                                />
                            </div>

                            {/* Warranty */}
                            <div>
                                <FieldLabel>រយៈពេលធានា Warranty</FieldLabel>
                                <EditableInput
                                    type="text"
                                    name="warranty_duration"
                                    value={formData.warranty_duration ?? ''}
                                    onChange={handleChange}
                                    placeholder="ឧ. 3 months, 1 year..."
                                />
                            </div>

                            {/* Estimated Duration */}
                            <div>
                                <FieldLabel>រយៈពេលជួសជុលប៉ាន់ស្មាន</FieldLabel>
                                <EditableInput
                                    type="text"
                                    name="estimated_duration"
                                    value={formData.estimated_duration ?? ''}
                                    onChange={handleChange}
                                    placeholder="ឧ. 30 mins, 2 hours..."
                                />
                            </div>

                            {/* Description */}
                            <div className="lg:col-span-2">
                                <FieldLabel>កំណត់ចំណាំ (Description)</FieldLabel>
                                <EditableTextarea
                                    name="description"
                                    value={formData.description ?? ''}
                                    onChange={handleChange}
                                    placeholder="ព័ត៌មានបន្ថែមអំពីសេវាកម្មនេះ..."
                                />
                            </div>
                        </div>
                    </section>
                </div>

                {/* Right sidebar */}
                <aside className="space-y-6">
                    {/* Image upload */}
                    <section>
                        <div className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-800">
                            <Rows3 size={18} className="text-[#1a9e52]" />
                            រូបភាពសេវាកម្ម
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
                                        className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white shadow-md hover:bg-red-600"
                                    >
                                        <X size={14} />
                                    </button>
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
                                <span>Labor Cost</span>
                                <span className="font-semibold text-slate-800">
                                    ${Number(formData.labor_cost).toFixed(2)}
                                </span>
                            </div>
                            <div className="flex items-center justify-between gap-4 rounded-2xl bg-white px-4 py-3">
                                <span>Sale Price</span>
                                <span className="font-semibold text-slate-800">
                                    ${Number(formData.sale_price).toFixed(2)}
                                </span>
                            </div>
                        </div>

                        <div className="mt-6 flex flex-col-reverse gap-3">
                            <Link
                                href="/inventory/none_stock"
                                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-center font-medium text-slate-600 transition-colors hover:bg-slate-50"
                            >
                                បោះបង់ (Cancel)
                            </Link>
                            <button
                                type="submit"
                                disabled={isSaving}
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
                                    : 'រក្សាទុក (Save)'}
                            </button>
                        </div>
                    </section>
                </aside>
            </form>
        </div>
    );
}
