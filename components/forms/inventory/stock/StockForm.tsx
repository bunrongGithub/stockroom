'use client';
import { usePageActions } from '@/hook/usePageAction';
import { generateSequenNumbering } from '@/lib/utils/sequenumbering';
import { resolveHref } from '@/utils/utils';
import { AlertCircle, Edit, Package, Plus, Search, Trash2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';

export interface InventoryItemProps {
    id: number;

    created_at: string;
    writed_at?: string | null;

    create_uid?: number | null;
    write_uid?: number | null;

    name: string;

    reference_no?: string | null;
    sku?: string | null;

    price: number;
    sale_price: number;
    purchase_price: number;

    stock?: number | null;

    is_variant: boolean;
    is_discount: boolean;

    category_id: number;
    category: {
        id: number;
        name: string;
    };
    item_class: 'stock' | 'non_stock';

    images_url?: string[] | null | string | any;
    uom_id: number;
    uom: {
        id: number;
        name: string;
    };
}

export default function StockForm({
    inv_items,
}: {
    inv_items: Array<InventoryItemProps>;
}) {
    const [searchQuery, setSearchQuery] = useState('');
    const pageAction = usePageActions();
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const [toast, setToast] = useState<{
        msg: string;
        type: 'success' | 'error';
    } | null>(null);

    const staticActions = pageAction?.actions.filter((a) => !a.dynamic) ?? [];
    const dynamicActions = pageAction?.actions.filter((a) => a.dynamic) ?? [];

    const onConfirm = async () => {
        if (!deletingId) return;

        try {
            setIsDeleting(true);

            const res = await fetch(`/api/category/${deletingId}`, {
                method: 'DELETE',
            });

            if (!res.ok) {
                throw new Error('Delete failed');
            }

            setToast({
                msg: 'Delete successful',
                type: 'success',
            });

            // Optional refresh
            window.location.reload();
        } catch (error) {
            setToast({
                msg: 'Delete failed',
                type: 'error',
            });
        } finally {
            setIsDeleting(false);
            setDeletingId(null);
        }
    };
    return (
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
                {/* Static actions (e.g. Create) — no id required */}
                <div className="flex items-center gap-2">
                    {staticActions.map((action) => {
                        const Icon = action.icon;
                        return (
                            <Link
                                key={action.label}
                                href={action.href as string}
                                className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium shadow-sm transition-colors"
                            >
                                {Icon && <Icon size={16} />}
                                {action.label}
                            </Link>
                        );
                    })}
                </div>
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
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden relative">
                <div className="overflow-x-auto min-h-75">
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
                                    Category
                                </th>
                                <th
                                    scope="col"
                                    className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider"
                                >
                                    UOM
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
                            {inv_items.map((item) => (
                                <tr
                                    key={item.id}
                                    className="hover:bg-slate-50/80 transition-colors"
                                >
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="inline-flex items-center text-xs font-medium text-slate-700">
                                            {item.reference_no}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-3">
                                            {item.images_url ? (
                                                <div className="w-10 h-10 rounded-lg overflow-hidden border border-slate-200 shrink-0">
                                                    <Image
                                                        src={item.images_url}
                                                        alt={item.name}
                                                        className="w-full h-full object-cover"
                                                    />
                                                </div>
                                            ) : (
                                                <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                                                    <Package size={20} />
                                                </div>
                                            )}

                                            <div>
                                                <div className="text-sm font-medium text-slate-800">
                                                    {item.name}
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
                                            {item.category.name}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="text-xs font-medium text-slate-700">
                                            {item.uom.name}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            <span
                                                className={`text-sm font-semibold ${item.stock! === 0 ? 'text-red-600' : item?.stock! < 10 ? 'text-amber-600' : 'text-slate-700'}`}
                                            >
                                                {item.stock ?? 0}
                                            </span>
                                            {item.stock! === 0 && (
                                                <AlertCircle
                                                    size={14}
                                                    className="text-red-500"
                                                />
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 font-medium">
                                        ${item.price.toFixed(2)}
                                    </td>
                                    {/* ── Dynamic actions per row ── */}
                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                        <div className="inline-flex items-center gap-2 justify-end">
                                            {dynamicActions.map((action) => {
                                                const Icon = action.icon;

                                                // Resolve href: replace ':id' with the
                                                // actual row id from the dataset template
                                                const href = resolveHref(
                                                    action.href as string,
                                                    item.id,
                                                );

                                                // Delete has no href navigation —
                                                // identified by label, fires handler
                                                if (
                                                    action.label.toLowerCase() ===
                                                    'delete'
                                                ) {
                                                    return (
                                                        <button
                                                            key={action.label}
                                                            type="button"
                                                            onClick={() =>
                                                                setDeletingId(
                                                                    item.id,
                                                                )
                                                            }
                                                            disabled={
                                                                deletingId ===
                                                                item.id
                                                            }
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors disabled:opacity-40"
                                                        >
                                                            {Icon && (
                                                                <Icon
                                                                    size={13}
                                                                />
                                                            )}
                                                            {action.label}
                                                        </button>
                                                    );
                                                }

                                                // All other dynamic actions → Link
                                                return (
                                                    <Link
                                                        key={action.label}
                                                        href={href}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-sky-600 hover:bg-sky-50 border border-sky-200 transition-colors"
                                                    >
                                                        {Icon && (
                                                            <Icon size={13} />
                                                        )}
                                                        {action.label}
                                                    </Link>
                                                );
                                            })}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
