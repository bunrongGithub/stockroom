'use client';

import { supabase } from '@/lib/supabase/client';
import {
    ArrowLeft,
    Loader2,
    Package,
    Plus,
    Rows3,
    Upload,
    X,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

interface InventoryFormProps {
    itemId?: string;
}

interface PurchaseHistoryItem {
    model?: string | null;
}

interface VariantOption {
    id: string;
    name: string;
    value: string;
}

const initialVariantOption = (): VariantOption => ({
    id: crypto.randomUUID(),
    name: '',
    value: '',
});

const initialFormData = {
    name: '',
    category: '',
    quantity: 0,
    price: 0,
    purchasePriceUsd: 0,
    uom: 'pcs',
    image: '',
    isItemVariant: false,
    variantOptions: [initialVariantOption()],
};

const uomOptions = [
    { value: 'pcs', label: 'PCS' },
    { value: 'box', label: 'BOX' },
    { value: 'set', label: 'SET' },
    { value: 'pack', label: 'PACK' },
    { value: 'unit', label: 'UNIT' },
    { value: 'kg', label: 'KG' },
    { value: 'g', label: 'G' },
    { value: 'm', label: 'M' },
];

const categoryOptions = [
    { value: 'Phone', label: 'Phone (ទូរស័ព្ទ)' },
    { value: 'Cases', label: 'Cases (សំបកទូរស័ព្ទ)' },
    { value: 'Accessories', label: 'Accessories (គ្រឿងបន្លាស់)' },
    { value: 'Chargers', label: 'Chargers (ឆ្នាំងសាក)' },
    { value: 'Screens', label: 'Screen Protectors (ស្គ្រីនការពារ)' },
];

const parseVariantOptions = (value: unknown): VariantOption[] => {
    if (!Array.isArray(value)) return [initialVariantOption()];

    const parsed = value
        .map((item) => {
            if (!item || typeof item !== 'object') return null;

            const option = item as { name?: unknown; value?: unknown };
            return {
                id: crypto.randomUUID(),
                name: typeof option.name === 'string' ? option.name : '',
                value: typeof option.value === 'string' ? option.value : '',
            };
        })
        .filter((item): item is VariantOption => item !== null);

    return parsed.length > 0 ? parsed : [initialVariantOption()];
};

export default function InventoryForm({ itemId }: InventoryFormProps) {
    const router = useRouter();
    const isEditMode = Boolean(itemId);

    const [isPageLoading, setIsPageLoading] = useState(isEditMode);
    const [isSaving, setIsSaving] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [purchaseHistoryNames, setPurchaseHistoryNames] = useState<string[]>(
        [],
    );
    const [formData, setFormData] = useState(initialFormData);

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const loadPurchaseHistory = () => {
            const savedPurchases = localStorage.getItem('icase_purchases_data');
            if (!savedPurchases) return;

            const parsedPurchases = JSON.parse(
                savedPurchases,
            ) as PurchaseHistoryItem[];
            const models = Array.from(
                new Set(
                    parsedPurchases
                        .map((purchase) => purchase.model)
                        .filter(Boolean),
                ),
            ) as string[];
            setPurchaseHistoryNames(models);
        };

        loadPurchaseHistory();
    }, []);

    useEffect(() => {
        if (!itemId) return;

        const fetchItem = async () => {
            setIsPageLoading(true);

            try {
                const { data, error } = await supabase
                    .from('inventory')
                    .select('*')
                    .eq('id', itemId)
                    .single();

                if (error) throw error;

                setFormData({
                    name: data.name,
                    category: data.category,
                    quantity: Number(data.quantity) || 0,
                    price: Number(data.price) || 0,
                    purchasePriceUsd: Number(data.purchase_price_usd) || 0,
                    uom: data.uom || 'pcs',
                    image: data.image_url || '',
                    isItemVariant: Boolean(data.is_item_variant),
                    variantOptions: parseVariantOptions(data.variant_options),
                });
            } catch (error) {
                console.error('Error fetching inventory item:', error);
                alert('មានបញ្ហាក្នុងការទាញយកទិន្នន័យទំនិញនេះ!');
                router.push('/inventory');
            } finally {
                setIsPageLoading(false);
            }
        };

        void fetchItem();
    }, [itemId, router]);

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
    ) => {
        const { name, value } = e.target;

        setFormData((prev) => ({
            ...prev,
            [name]:
                name === 'quantity' ||
                name === 'price' ||
                name === 'purchasePriceUsd'
                    ? Number(value)
                    : value,
        }));
    };

    const handleVariantToggle = (checked: boolean) => {
        setFormData((prev) => ({
            ...prev,
            isItemVariant: checked,
            variantOptions: checked
                ? prev.variantOptions.length > 0
                    ? prev.variantOptions
                    : [initialVariantOption()]
                : [initialVariantOption()],
        }));
    };

    const handleVariantChange = (
        id: string,
        field: 'name' | 'value',
        value: string,
    ) => {
        setFormData((prev) => ({
            ...prev,
            variantOptions: prev.variantOptions.map((option) =>
                option.id === id ? { ...option, [field]: value } : option,
            ),
        }));
    };

    const addVariantRow = () => {
        setFormData((prev) => ({
            ...prev,
            variantOptions: [...prev.variantOptions, initialVariantOption()],
        }));
    };

    const removeVariantRow = (id: string) => {
        setFormData((prev) => ({
            ...prev,
            variantOptions:
                prev.variantOptions.length === 1
                    ? [initialVariantOption()]
                    : prev.variantOptions.filter((option) => option.id !== id),
        }));
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 32 * 1024 * 1024) {
            alert('សូមជ្រើសរើសរូបភាពដែលមានទំហំតូចជាង 32MB');
            return;
        }

        setSelectedFile(file);
        setFormData((prev) => ({ ...prev, image: URL.createObjectURL(file) }));
    };

    const removeImage = () => {
        setFormData((prev) => ({ ...prev, image: '' }));
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const triggerFileInput = () => {
        fileInputRef.current?.click();
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();

        const cleanedVariantOptions = formData.isItemVariant
            ? formData.variantOptions
                  .map((option) => ({
                      name: option.name.trim(),
                      value: option.value.trim(),
                  }))
                  .filter((option) => option.name || option.value)
            : [];

        if (formData.isItemVariant && cleanedVariantOptions.length === 0) {
            alert('សូមបញ្ចូលយ៉ាងហោចណាស់ Variant មួយ');
            return;
        }

        if (
            cleanedVariantOptions.some(
                (option) => !option.name || !option.value,
            )
        ) {
            alert('សូមបំពេញ Name និង Value របស់ Variant ឲ្យបានគ្រប់');
            return;
        }

        setIsSaving(true);

        try {
            let finalImageUrl = formData.image;

            if (selectedFile) {
                const imgFormData = new FormData();
                imgFormData.append('image', selectedFile);

                const imgbbApiKey = process.env.NEXT_PUBLIC_IMGBB_API_KEY;
                if (!imgbbApiKey) {
                    throw new Error(
                        'រកមិនឃើញ ImgBB API Key! សូមត្រួតពិនិត្យឯកសារ .env.local របស់អ្នក។',
                    );
                }

                const response = await fetch(
                    `https://api.imgbb.com/1/upload?key=${imgbbApiKey}`,
                    {
                        method: 'POST',
                        body: imgFormData,
                    },
                );

                const data = await response.json();
                if (!data.success) {
                    throw new Error('បរាជ័យក្នុងការ Upload រូបភាពទៅកាន់ ImgBB');
                }

                finalImageUrl = data.data.url;
            }

            const payload = {
                name: formData.name,
                category: formData.category,
                quantity: formData.quantity,
                price: formData.price,
                purchase_price_usd: formData.purchasePriceUsd,
                uom: formData.uom,
                is_item_variant: formData.isItemVariant,
                variant_options: cleanedVariantOptions,
                image_url: finalImageUrl || null,
            };

            if (itemId) {
                const { error } = await supabase
                    .from('inventory')
                    .update(payload)
                    .eq('id', itemId);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('inventory')
                    .insert([payload]);
                if (error) throw error;
            }

            window.dispatchEvent(new Event('inventory_updated'));
            router.push('/inventory');
            router.refresh();
        } catch (error: unknown) {
            console.error('Error saving item:', error);
            const message =
                error instanceof Error
                    ? error.message
                    : 'មានបញ្ហាក្នុងការរក្សាទុកទិន្នន័យទៅកាន់ Database!';
            alert(message);
        } finally {
            setIsSaving(false);
        }
    };

    if (isPageLoading) {
        return (
            <div className="mx-auto max-w-6xl p-4 md:p-8">
                <div className="flex items-center justify-center gap-3 rounded-3xl border border-slate-100 bg-white p-10 font-semibold text-[#1a9e52] shadow-sm">
                    <Loader2 className="animate-spin" size={24} />
                    កំពុងទាញយកទិន្នន័យ...
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
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
                        {isEditMode ? 'កែប្រែទំនិញ' : 'បន្ថែមទំនិញថ្មី'}
                    </h2>
                    <p className="mt-2 text-sm text-slate-500">
                        បំពេញព័ត៌មានទំនិញ ស្តុក តម្លៃ និង Variant
                        សម្រាប់ប្រើក្នុងប្រព័ន្ធ។
                    </p>
                </div>
            </div>

            <form
                onSubmit={handleSave}
                className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_360px]"
            >
                <div className="space-y-6">
                    <section className="rounded-md border border-slate-50">
                        <div className="mb-6 flex items-center justify-between gap-4">
                            <div>
                                <h3 className="text-lg font-semibold text-slate-800">
                                    ព័ត៌មានទំនិញ
                                </h3>
                                <p className="mt-1 text-sm text-slate-500">
                                    គ្រប់គ្រងឈ្មោះ ប្រភេទ UOM និងតម្លៃរបស់ទំនិញ
                                </p>
                            </div>
                        </div>

                        <div className="grid gap-5 lg:grid-cols-2">
                            <div className="lg:col-span-2">
                                <label className="mb-1 block text-sm font-medium text-slate-700">
                                    ឈ្មោះទំនិញ
                                </label>

                                <datalist id="inventory-purchase-history">
                                    {purchaseHistoryNames.map((model, idx) => (
                                        <option key={idx} value={model} />
                                    ))}
                                </datalist>

                                <input
                                    type="text"
                                    name="name"
                                    list="inventory-purchase-history"
                                    required
                                    value={formData.name}
                                    onChange={handleChange}
                                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-[#1a9e52] focus:outline-none focus:ring-2 focus:ring-[#1a9e52]/20"
                                    placeholder="ឧ. iPhone Case..."
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">
                                    ប្រភេទ
                                </label>
                                <select
                                    name="category"
                                    required
                                    value={formData.category}
                                    onChange={handleChange}
                                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-[#1a9e52] focus:outline-none focus:ring-2 focus:ring-[#1a9e52]/20"
                                >
                                    <option value="" disabled>
                                        ជ្រើសរើសប្រភេទ...
                                    </option>
                                    {categoryOptions.map((option) => (
                                        <option
                                            key={option.value}
                                            value={option.value}
                                        >
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">
                                    UOM
                                </label>
                                <select
                                    name="uom"
                                    required
                                    value={formData.uom}
                                    onChange={handleChange}
                                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm uppercase focus:border-[#1a9e52] focus:outline-none focus:ring-2 focus:ring-[#1a9e52]/20"
                                >
                                    {uomOptions.map((option) => (
                                        <option
                                            key={option.value}
                                            value={option.value}
                                        >
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">
                                    តម្លៃទិញចូល
                                </label>
                                <input
                                    type="number"
                                    name="purchasePriceUsd"
                                    required
                                    min="0"
                                    step="0.01"
                                    value={formData.purchasePriceUsd}
                                    onChange={handleChange}
                                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-[#1a9e52] focus:outline-none focus:ring-2 focus:ring-[#1a9e52]/20"
                                    placeholder="0.00"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">
                                    តម្លៃលក់ ($)
                                </label>
                                <input
                                    type="number"
                                    name="price"
                                    required
                                    min="0"
                                    step="0.01"
                                    value={formData.price}
                                    onChange={handleChange}
                                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-[#1a9e52] focus:outline-none focus:ring-2 focus:ring-[#1a9e52]/20"
                                />
                            </div>

                            <div className="lg:col-span-2">
                                <label className="mb-1 block text-sm font-medium text-slate-700">
                                    ចំនួនស្តុក
                                </label>
                                <input
                                    type="number"
                                    name="quantity"
                                    required
                                    min="0"
                                    value={formData.quantity}
                                    onChange={handleChange}
                                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-[#1a9e52] focus:outline-none focus:ring-2 focus:ring-[#1a9e52]/20"
                                />
                            </div>
                        </div>
                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                            <div>
                                <h3 className="text-lg font-semibold text-slate-800">
                                    Variant Options
                                </h3>
                                <p className="mt-1 text-sm text-slate-500">
                                    បើទំនិញនេះមាន Variant សូមបើក option ខាងក្រោម
                                    ហើយបញ្ចូល Name និង Value
                                </p>
                            </div>

                            <label className="inline-flex items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700">
                                <input
                                    type="checkbox"
                                    checked={formData.isItemVariant}
                                    onChange={(e) =>
                                        handleVariantToggle(e.target.checked)
                                    }
                                    className="h-4 w-4 rounded border-slate-300 text-[#1a9e52] focus:ring-[#1a9e52]/20"
                                />
                                is_item_variant
                            </label>
                        </div>

                        {formData.isItemVariant ? (
                            <div className="mt-6 space-y-4">
                                <div className="overflow-hidden rounded-2xl border border-slate-200">
                                    <table className="min-w-full divide-y divide-slate-200">
                                        <thead className="bg-slate-50">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                                                    Name
                                                </th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                                                    Value
                                                </th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                                                    Action
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 bg-white">
                                            {formData.variantOptions.map(
                                                (option) => (
                                                    <tr key={option.id}>
                                                        <td className="px-4 py-3">
                                                            <input
                                                                type="text"
                                                                value={
                                                                    option.name
                                                                }
                                                                onChange={(e) =>
                                                                    handleVariantChange(
                                                                        option.id,
                                                                        'name',
                                                                        e.target
                                                                            .value,
                                                                    )
                                                                }
                                                                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-[#1a9e52] focus:outline-none focus:ring-2 focus:ring-[#1a9e52]/20"
                                                                placeholder="ឧ. Color"
                                                            />
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <input
                                                                type="text"
                                                                value={
                                                                    option.value
                                                                }
                                                                onChange={(e) =>
                                                                    handleVariantChange(
                                                                        option.id,
                                                                        'value',
                                                                        e.target
                                                                            .value,
                                                                    )
                                                                }
                                                                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-[#1a9e52] focus:outline-none focus:ring-2 focus:ring-[#1a9e52]/20"
                                                                placeholder="ឧ. Red"
                                                            />
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    removeVariantRow(
                                                                        option.id,
                                                                    )
                                                                }
                                                                className="inline-flex items-center justify-center rounded-lg border border-red-200 p-2 text-red-500 transition-colors hover:bg-red-50"
                                                                aria-label="Remove variant row"
                                                            >
                                                                <X size={16} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ),
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                <button
                                    type="button"
                                    onClick={addVariantRow}
                                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                                >
                                    <Plus size={16} />
                                    បន្ថែម Variant
                                </button>
                            </div>
                        ) : (
                            <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-5 text-sm text-slate-500">
                                Variant table នឹងបង្ហាញនៅពេលបើក
                                `is_item_variant`
                            </div>
                        )}
                    </section>
                </div>

                <aside className="space-y-6">
                    <section>
                        <div className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-800">
                            <Rows3 size={18} className="text-[#1a9e52]" />
                            រូបភាពទំនិញ
                        </div>
                        <div
                            className={`cursor-pointer rounded-2xl border-2 border-dashed p-4 text-center transition-all ${
                                formData.image
                                    ? 'border-[#1a9e52]/50 bg-[#1a9e52]/5'
                                    : 'border-slate-300 hover:border-[#1a9e52] hover:bg-slate-50'
                            }`}
                            onClick={
                                !formData.image ? triggerFileInput : undefined
                            }
                        >
                            <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                ref={fileInputRef}
                                onChange={handleImageUpload}
                            />
                            {formData.image ? (
                                <div className="relative inline-block">
                                    <Image
                                        src={formData.image}
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

                    <section>
                        <h3 className="text-lg font-semibold text-slate-800">
                            សង្ខេបទិន្នន័យ
                        </h3>
                        <div className="mt-4 space-y-3 text-sm text-slate-600">
                            <div className="flex items-center justify-between gap-4 rounded-2xl bg-white px-4 py-3">
                                <span>UOM</span>
                                <span className="font-semibold uppercase text-slate-800">
                                    {formData.uom || '-'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between gap-4 rounded-2xl bg-white px-4 py-3">
                                <span>Purchase USD</span>
                                <span className="font-semibold text-slate-800">
                                    ${formData.purchasePriceUsd.toFixed(2)}
                                </span>
                            </div>
                            <div className="flex items-center justify-between gap-4 rounded-2xl bg-white px-4 py-3">
                                <span>Sell Price</span>
                                <span className="font-semibold text-slate-800">
                                    ${formData.price.toFixed(2)}
                                </span>
                            </div>
                            <div className="flex items-center justify-between gap-4 rounded-2xl bg-white px-4 py-3">
                                <span>Variants</span>
                                <span className="font-semibold text-slate-800">
                                    {formData.isItemVariant
                                        ? formData.variantOptions.filter(
                                              (option) =>
                                                  option.name || option.value,
                                          ).length
                                        : 0}
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
