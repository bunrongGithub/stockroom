'use client';
import { usePageActions } from '@/hook/usePageAction';
import { InventoryItemProps } from '@/types/inventory/item';
import { resolveHref } from '@/utils/utils';
import { Package, Search } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';

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
                                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
                            >
                                {Icon && <Icon size={16} />}
                                {action.label}
                            </Link>
                        );
                    })}
                </div>
            </div>

            {/* Main Content */}
            <div className="mx-auto">
                {/* Search Bar */}
                <div className="mb-8">
                    <div className="relative max-w-md">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <Search size={18} className="text-gray-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search by name, SKU, or reference..."
                            className="block w-full pl-11 pr-4 py-2.5 border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm transition-all"
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
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                        Reference
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                        Item Name
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                        Category
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                        UOM
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                        Sale Price
                                    </th>
                                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-100">
                                {inv_items.map((item) => (
                                    <tr
                                        key={item.id}
                                        className="hover:bg-gray-50/80 transition-colors"
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-2.5 py-1 rounded">
                                                {item.reference_no || '—'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-3">
                                                {item.images_url &&
                                                item.images_url.length > 0 ? (
                                                    <div className="w-10 h-10 rounded-lg overflow-hidden border border-gray-200 shrink-0">
                                                        <Image
                                                            src={
                                                                item
                                                                    .images_url[0]
                                                            }
                                                            alt={item.name}
                                                            width={40}
                                                            height={40}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    </div>
                                                ) : (
                                                    <div className="w-10 h-10 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-400 shrink-0">
                                                        <Package size={20} />
                                                    </div>
                                                )}
                                                <div>
                                                    <div className="text-sm font-semibold text-gray-900">
                                                        {item.name}
                                                    </div>
                                                    <div className="text-xs text-gray-500 mt-0.5">
                                                        {item.item_class ===
                                                        'stock'
                                                            ? 'Stock Item'
                                                            : 'Non-Stock / Service'}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>

                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-xs font-medium text-gray-700">
                                                {item.category?.name ?? ''}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-xs font-medium text-gray-700">
                                                {item.uom?.name ?? ''}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-sm font-semibold text-gray-900">
                                                ${item.sale_price.toFixed(2)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {dynamicActions.map(
                                                    (action) => {
                                                        const Icon =
                                                            action.icon;
                                                        const href =
                                                            resolveHref(
                                                                action.href as string,
                                                                Number(item.id),
                                                            );

                                                        if (
                                                            action.label.toLowerCase() ===
                                                            'delete'
                                                        ) {
                                                            return (
                                                                <button
                                                                    key={
                                                                        action.label
                                                                    }
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
                                                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 border border-red-200 transition-colors disabled:opacity-50"
                                                                >
                                                                    {Icon && (
                                                                        <Icon
                                                                            size={
                                                                                13
                                                                            }
                                                                        />
                                                                    )}
                                                                    {
                                                                        action.label
                                                                    }
                                                                </button>
                                                            );
                                                        }

                                                        return (
                                                            <Link
                                                                key={
                                                                    action.label
                                                                }
                                                                href={href}
                                                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-blue-600 hover:bg-blue-50 border border-blue-200 transition-colors"
                                                            >
                                                                {Icon && (
                                                                    <Icon
                                                                        size={
                                                                            13
                                                                        }
                                                                    />
                                                                )}
                                                                {action.label}
                                                            </Link>
                                                        );
                                                    },
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
