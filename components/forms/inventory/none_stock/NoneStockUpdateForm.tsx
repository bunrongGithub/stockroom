'use client';

import AsyncSearchSelect from '@/components/ui/AsyncSearchSelect';
import {
    EditableInput,
    EditableTextarea,
    FieldLabel,
} from '@/components/ui/FieldLabel';
import { AlertCircle, ArrowLeft, Loader2, Settings, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface ItemRelation {
    id: number | null;
    name: string;
}

export interface NoneStockUpdateItemData {
    id: number;
    name: string;
    item_class: string;
    reference_no: string;
    labor_cost: number;
    sale_price: number;
    warranty_duration: string | null;
    estimated_duration: string | null;
    category_id: number | null;
    uom_id: number | null;
    images_url: string[] | null;
    description?: string | null;
    category?: ItemRelation | null;
    uom?: ItemRelation | null;
}

interface Props {
    item: NoneStockUpdateItemData;
}

export default function NoneStockUpdateForm({ item }: Props) {
    const router = useRouter();
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [toast, setToast] = useState<{
        msg: string;
        type: 'success' | 'error';
    } | null>(null);

    const [form, setForm] = useState({
        name: item.name ?? '',
        labor_cost: item.labor_cost ?? 0,
        sale_price: item.sale_price ?? 0,
        warranty_duration: item.warranty_duration ?? '',
        estimated_duration: item.estimated_duration ?? '',
        description: item.description ?? '',
        category_id: item.category_id,
        category: item.category ?? { id: null, name: '' },
        uom_id: item.uom_id,
        uom: item.uom ?? { id: null, name: '' },
    });

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
            const res = await fetch(`/api/inventory/${item.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: form.name.trim(),
                    purchase_price: Number(form.labor_cost),
                    labor_cost: Number(form.labor_cost),
                    sale_price: Number(form.sale_price),
                    warranty_duration: form.warranty_duration,
                    estimated_duration: form.estimated_duration,
                    description: form.description,
                    category_id: form.category_id,
                    uom_id: form.uom_id,
                }),
            });

            const json = await res.json();
            if (!res.ok) {
                throw new Error(
                    json.error?.message ?? json.error ?? 'Update failed',
                );
            }

            showToast(
                'សេវាកម្មត្រូវបានធ្វើបច្ចុប្បន្នភាពដោយជោគជ័យ',
                'success',
            );
            setTimeout(() => {
                router.push(`/inventory/none_stock/${item.id}/view`);
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
                        href={`/inventory/none_stock`}
                        className="inline-flex items-center gap-2 text-sm text-slate-500 transition-colors hover:text-slate-700"
                    >
                        <ArrowLeft size={16} />
                        ត្រឡប់ទៅទំព័រសេវាកម្ម
                    </Link>
                    <h2 className="mt-3 flex items-center gap-2 text-2xl font-bold text-slate-800">
                        <Settings className="text-[#1a9e52]" />
                        កែប្រែសេវាកម្ម
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                        Ref: {item.reference_no || '-'}
                    </p>
                </div>

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
                            className="ml-auto text-red-400 hover:text-red-600"
                            aria-label="Dismiss error"
                        >
                            <X size={16} />
                        </button>
                    </div>
                )}

                <form
                    onSubmit={handleSubmit}
                    className="space-y-5 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm"
                >
                    <div>
                        <FieldLabel required>ឈ្មោះសេវាកម្ម (Service Name)</FieldLabel>
                        <EditableInput
                            value={form.name}
                            onChange={(e) =>
                                setForm({ ...form, name: e.target.value })
                            }
                            placeholder="ឧ. ប្តូរអេក្រង់ iPhone 13 Pro"
                            required
                        />
                    </div>

                    <AsyncSearchSelect
                        label="ប្រភេទសេវាកម្ម (Category)"
                        apiUrl="/api/category"
                        value={form.category_id}
                        onChange={(selected) =>
                            setForm({
                                ...form,
                                category_id: selected?.id
                                    ? Number(selected.id)
                                    : null,
                                category: {
                                    id: selected?.id
                                        ? Number(selected.id)
                                        : null,
                                    name: selected?.name ?? '',
                                },
                            })
                        }
                        placeholder={
                            form.category?.name || 'ជ្រើសរើសប្រភេទសេវាកម្ម...'
                        }
                    />

                    <AsyncSearchSelect
                        label="ឯកតារង្វាស់ (Unit of Measure)"
                        apiUrl="/api/uom"
                        value={form.uom_id}
                        onChange={(selected) =>
                            setForm({
                                ...form,
                                uom_id: selected?.id
                                    ? Number(selected.id)
                                    : null,
                                uom: {
                                    id: selected?.id
                                        ? Number(selected.id)
                                        : null,
                                    name: selected?.name ?? '',
                                },
                            })
                        }
                        placeholder={form.uom?.name || 'ជ្រើសរើស UOM...'}
                    />

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <FieldLabel>ថ្លៃពលកម្ម / Base Price ($)</FieldLabel>
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
                                placeholder="0.00"
                            />
                        </div>
                        <div>
                            <FieldLabel required>តម្លៃសរុប / Sale Price ($)</FieldLabel>
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
                                placeholder="0.00"
                                required
                            />
                        </div>
                        <div>
                            <FieldLabel>រយៈពេលធានា (Warranty)</FieldLabel>
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
                            />
                        </div>
                        <div>
                            <FieldLabel>រយៈពេលប៉ាន់ស្មាន (Estimated Duration)</FieldLabel>
                            <EditableInput
                                type="text"
                                value={form.estimated_duration}
                                onChange={(e) =>
                                    setForm({
                                        ...form,
                                        estimated_duration: e.target.value,
                                    })
                                }
                                placeholder="ឧ. 30 mins, 2 hours..."
                            />
                        </div>
                    </div>

                    <div>
                        <FieldLabel>កំណត់ចំណាំ (Description)</FieldLabel>
                        <EditableTextarea
                            value={form.description}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    description: e.target.value,
                                })
                            }
                            placeholder="ព័ត៌មានបន្ថែមអំពីសេវាកម្មនេះ..."
                            rows={3}
                        />
                    </div>

                    <div className="flex items-center gap-3 border-t border-slate-100 pt-5">
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex items-center gap-2 rounded-xl bg-[#1a9e52] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#158042] disabled:opacity-50"
                        >
                            {saving && (
                                <Loader2 size={15} className="animate-spin" />
                            )}
                            {saving
                                ? 'កំពុងរក្សាទុក...'
                                : 'រក្សាទុកការផ្លាស់ប្តូរ'}
                        </button>
                        <Link
                            href={`/inventory/none_stock`}
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
