'use client';

import { Edit, Package, Plus, Search, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

type Item = {
    id: number;
    name: string;
    reference_no: string | null;
};

type FormState = { name: string; reference_no: string };
type Mode = 'idle' | 'create' | 'edit';

const EMPTY_FORM: FormState = { name: '', reference_no: '' };

export default function ItemsPage() {
    const [items, setItems] = useState<Item[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [mode, setMode] = useState<Mode>('idle');
    const [editingId, setEditingId] = useState<number | null>(null);
    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [errors, setErrors] = useState<Partial<FormState>>({});
    const [toast, setToast] = useState<{
        msg: string;
        type: 'success' | 'error';
    } | null>(null);

    // ─── Data fetching ────────────────────────────────────────────────────────
    const fetchItems = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/category');
            const json = await res.json();
            if (!res.ok) {
                throw new Error(
                    typeof json.error === 'string'
                        ? json.error
                        : 'Failed to fetch categories',
                );
            }
            setItems(json.data ?? []);
        } catch (error) {
            showToast(
                error instanceof Error ? error.message : 'Failed to load items',
                'error',
            );
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const boot = window.setTimeout(() => {
            void fetchItems();
        }, 0);

        return () => {
            window.clearTimeout(boot);
        };
    }, [fetchItems]);

    // ─── Toast ────────────────────────────────────────────────────────────────
    function showToast(msg: string, type: 'success' | 'error') {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    }

    // ─── Form helpers ─────────────────────────────────────────────────────────
    function openCreate() {
        setForm(EMPTY_FORM);
        setErrors({});
        setEditingId(null);
        setMode('create');
    }

    function openEdit(item: Item) {
        setForm({ name: item.name, reference_no: item.reference_no! });
        setErrors({});
        setEditingId(item.id);
        setMode('edit');
    }

    function closeForm() {
        setMode('idle');
        setEditingId(null);
        setForm(EMPTY_FORM);
        setErrors({});
    }

    function validate(): boolean {
        const errs: Partial<FormState> = {};
        setErrors(errs);
        return Object.keys(errs).length === 0;
    }

    // ─── CRUD actions ─────────────────────────────────────────────────────────
    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!validate()) return;
        setSaving(true);
        try {
            const isEdit = mode === 'edit' && editingId;
            const res = await fetch(
                isEdit ? `/api/category/${editingId}` : '/api/category',
                {
                    method: isEdit ? 'PATCH' : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: form.name,
                    }),
                },
            );
            const json = await res.json();
            if (!res.ok) {
                const msg =
                    typeof json.error === 'string'
                        ? json.error
                        : 'Validation failed';
                showToast(msg, 'error');
                return;
            }
            showToast(isEdit ? 'Item updated' : 'Item created', 'success');
            closeForm();
            fetchItems();
        } catch {
            showToast('Something went wrong', 'error');
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete(id: number) {
        if (!confirm('Delete this item?')) return;
        setDeletingId(id);
        try {
            const res = await fetch(`/api/category/${id}`, {
                method: 'DELETE',
            });
            if (!res.ok) throw new Error();
            showToast('Item deleted', 'success');
            setItems((prev) => prev.filter((i) => i.id !== id));
        } catch {
            showToast('Failed to delete item', 'error');
        } finally {
            setDeletingId(null);
        }
    }

    // ─── Render ───────────────────────────────────────────────────────────────
    return (
        <main>
            <div className="max-w-full mx-auto space-y-8 animate-in fade-in duration-500 p-4 md:p-8">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                            <Package className="text-[#1a9e52]" />
                            ឃ្លាំងទំនិញ
                        </h2>
                        <p className="text-slate-500 text-sm mt-1">
                            គ្រប់គ្រងបញ្ជីទំនិញ និងស្តុកដោយប្រើលេខរៀងសម្គាល់
                        </p>
                    </div>
                    <Link
                        href="/inventory/stock/create"
                        className="bg-[#1a9e52] hover:bg-[#158042] text-white px-5 py-2.5 rounded-xl font-medium shadow-sm transition-colors duration-200 flex items-center gap-2"
                    >
                        <Plus size={20} />
                        <span>បន្ថែមទំនិញថ្មី</span>
                    </Link>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative flex-1 max-w-md">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search size={18} className="text-slate-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="ស្វែងរកតាមឈ្មោះ ឬលេខកូដ"
                            className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-xl leading-5 bg-slate-50 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#1a9e52]/20 focus:border-[#1a9e52] sm:text-sm transition-all"
                            // value={searchQuery}
                            // onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden relative">
                    {/* {isLoading && (
                        <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-10 flex items-center justify-center">
                            <div className="flex items-center gap-2 text-[#1a9e52] font-semibold">
                                <Loader2 className="animate-spin" size={24} />{' '}
                                កំពុងទាញយកទិន្នន័យ...
                            </div>
                        </div>
                    )} */}

                    <div className="overflow-x-auto min-h-[300px]">
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th
                                        scope="col"
                                        className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider"
                                    >
                                        Reference
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider"
                                    >
                                        ឈ្មោះទំនិញ
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider"
                                    >
                                        ថ្នាក់ទំនិញ
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider"
                                    >
                                        ប្រភេទ
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider"
                                    >
                                        ចំនួនស្តុក
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider"
                                    >
                                        តម្លៃលក់
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider"
                                    >
                                        សកម្មភាព
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-100">
                                <tr className="hover:bg-slate-50/80 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="inline-flex items-center text-xs font-medium text-slate-700">
                                            {/* {generateSequenNumbering(
                                                        'INVS',
                                                    )} */}
                                            INV
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-3">
                                            <div>
                                                <div className="text-sm font-medium text-slate-800">
                                                    kkk
                                                </div>
                                                <div className="text-[10px] text-[#1a9e52] font-mono font-bold">
                                                    fjslf
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="text-xs font-medium text-slate-700">
                                            ប្រភេទ Stock
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="text-xs font-medium text-slate-700">
                                            Category
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            KKKK
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 font-medium">
                                        100
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <div className="flex justify-end gap-2">
                                            <Link
                                                href={`/inventory/stock/1/edit`}
                                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                title="កែប្រែ"
                                            >
                                                <Edit size={18} />
                                            </Link>
                                            <button
                                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                title="លុប"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            );
        </main>
    );
}
