'use client';
import { usePageActions } from '@/hook/usePageAction';
import { InventoryItemProps } from '@/types/inventory/item';
import { resolveHref } from '@/utils/utils';
import { Settings, Search, Package } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState } from 'react';

interface Props {
    inv_items: Array<InventoryItemProps>;
}

export default function NoneStockForm({ inv_items }: Props) {
    const [searchQuery, setSearchQuery] = useState('');
    const pageAction = usePageActions();
    const [deletingId, setDeletingId] = useState<number | null>(null);

    const staticActions = pageAction?.actions.filter((a) => !a.dynamic) ?? [];
    const dynamicActions = pageAction?.actions.filter((a) => a.dynamic) ?? [];

    const filteredItems = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();

        return inv_items.filter((item) => {
            const matchesSearch =
                !q ||
                item.name.toLowerCase().includes(q) ||
                (item.reference_no ?? '').toLowerCase().includes(q) ||
                (item.category?.name ?? '').toLowerCase().includes(q);

            return matchesSearch;
        });
    }, [inv_items, searchQuery]);

    return (
        <div className="max-w-full mx-auto space-y-8 animate-in fade-in duration-500 p-4 md:p-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Settings className="text-[#1a9e52]" />
                        សេវាកម្មជួសជុល (Repair Services)
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">
                        គ្រប់គ្រងបញ្ជីសេវាកម្មជួសជុលទូរសព្ទ និងតម្លៃពលកម្ម
                    </p>
                </div>
                {/* Static actions (e.g. Create) */}
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
                <div className="mb-8 flex flex-wrap items-center gap-3">
                    <div className="relative min-w-60 max-w-md flex-1">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <Search size={18} className="text-gray-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search by name, reference, or category..."
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
                                        Service Name
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                        Category
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                        Labor Cost / Base Price
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
                                {filteredItems.map((item) => (
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
                                                            src={item.images_url[0]}
                                                            alt={item.name}
                                                            width={40}
                                                            height={40}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    </div>
                                                ) : (
                                                    <div className="w-10 h-10 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-400 shrink-0">
                                                        <Settings size={20} />
                                                    </div>
                                                )}
                                                <div>
                                                    <div className="text-sm font-semibold text-gray-900">
                                                        {item.name}
                                                    </div>
                                                    <div className="text-xs text-gray-500 mt-0.5">
                                                        {item.item_class === 'non_stock' || item.item_class === 'service'
                                                            ? 'Service / Labor'
                                                            : item.item_class}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>

                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-xs font-medium text-gray-700">
                                                {item.category?.name ?? '—'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-sm font-semibold text-slate-500">
                                                ${(item.labor_cost ?? item.purchase_price ?? 0).toFixed(2)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-sm font-semibold text-[#1a9e52]">
                                                ${item.sale_price.toFixed(2)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {dynamicActions.map((action) => {
                                                    const Icon = action.icon;
                                                    const href = resolveHref(
                                                        action.href as string,
                                                        Number(item.id),
                                                    );

                                                    if (action.label.toLowerCase() === 'delete') {
                                                        return (
                                                            <button
                                                                key={action.label}
                                                                type="button"
                                                                onClick={() =>
                                                                    setDeletingId(item.id)
                                                                }
                                                                disabled={deletingId === item.id}
                                                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 border border-red-200 transition-colors disabled:opacity-50"
                                                            >
                                                                {Icon && <Icon size={13} />}
                                                                {action.label}
                                                            </button>
                                                        );
                                                    }

                                                    return (
                                                        <Link
                                                            key={action.label}
                                                            href={href}
                                                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-blue-600 hover:bg-blue-50 border border-blue-200 transition-colors"
                                                        >
                                                            {Icon && <Icon size={13} />}
                                                            {action.label}
                                                        </Link>
                                                    );
                                                })}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {filteredItems.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                            មិនមានសេវាកម្មជួសជុលនៅឡើយទេ
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
