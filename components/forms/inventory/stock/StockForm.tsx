'use client';
import { usePageActions } from '@/hook/usePageAction';
import { BranchProps } from '@/types/branch';
import { InventoryItemProps } from '@/types/inventory/item';
import { resolveHref } from '@/utils/utils';
import { MapPin, Package, Search } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState } from 'react';

interface Props {
    inv_items: Array<InventoryItemProps>;
    branches?: BranchProps[];
}

function LocationCell({ item }: { item: InventoryItemProps }) {
    if (item.item_class !== 'stock') {
        return <span className="text-xs text-slate-300">—</span>;
    }

    if (!item.stock_location) {
        return (
            <span className="text-xs italic text-slate-400">No location set</span>
        );
    }

    return (
        <div className="flex min-w-40 items-center gap-2">
            <MapPin size={13} className="shrink-0 text-slate-400" />
            <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-slate-700">
                    {item.stock_location.location_name ?? '—'}
                </p>
                {item.stock_location.branch_name && (
                    <p className="truncate text-[10px] text-slate-400">
                        {item.stock_location.branch_name}
                    </p>
                )}
            </div>
        </div>
    );
}

export default function StockForm({ inv_items, branches = [] }: Props) {
    const [searchQuery, setSearchQuery] = useState('');
    const [filterBranchId, setFilterBranchId] = useState<number | 'all'>('all');
    const [filterLocationId, setFilterLocationId] = useState<number | 'all'>('all');
    const pageAction = usePageActions();
    const [deletingId, setDeletingId] = useState<number | null>(null);

    const staticActions = pageAction?.actions.filter((a) => !a.dynamic) ?? [];
    const dynamicActions = pageAction?.actions.filter((a) => a.dynamic) ?? [];
    const allLocations = useMemo(
        () =>
            branches.flatMap((branch) =>
                (branch.stock_location ?? []).map((location) => ({
                    ...location,
                    branch_name: branch.name,
                })),
            ),
        [branches],
    );
    const branchLocations = useMemo(
        () =>
            filterBranchId === 'all'
                ? allLocations
                : allLocations.filter(
                      (location) => location.branch_id === filterBranchId,
                  ),
        [allLocations, filterBranchId],
    );
    const filteredItems = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();

        return inv_items.filter((item) => {
            const matchesSearch =
                !q ||
                item.name.toLowerCase().includes(q) ||
                (item.reference_no ?? '').toLowerCase().includes(q) ||
                (item.category?.name ?? '').toLowerCase().includes(q);
            const matchesLocation =
                filterLocationId === 'all' ||
                item.stock_location?.location_id === filterLocationId ||
                item.stock_balances?.some(
                    (balance) => balance.location_id === filterLocationId,
                );

            return matchesSearch && matchesLocation;
        });
    }, [filterLocationId, inv_items, searchQuery]);

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
                <div className="mb-8 flex flex-wrap items-center gap-3">
                    <div className="relative min-w-60 max-w-md flex-1">
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
                    {branches.length > 1 && (
                        <select
                            value={filterBranchId}
                            onChange={(e) => {
                                setFilterBranchId(
                                    e.target.value === 'all'
                                        ? 'all'
                                        : Number(e.target.value),
                                );
                                setFilterLocationId('all');
                            }}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                        >
                            <option value="all">All Branches</option>
                            {branches.map((branch) => (
                                <option key={branch.id} value={branch.id}>
                                    {branch.name}
                                </option>
                            ))}
                        </select>
                    )}
                    {branchLocations.length > 0 && (
                        <select
                            value={filterLocationId}
                            onChange={(e) =>
                                setFilterLocationId(
                                    e.target.value === 'all'
                                        ? 'all'
                                        : Number(e.target.value),
                                )
                            }
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                        >
                            <option value="all">All Locations</option>
                            {branchLocations.map((location) => (
                                <option key={location.id} value={location.id}>
                                    {location.code ? `[${location.code}] ` : ''}
                                    {location.name}
                                    {branches.length > 1
                                        ? ` - ${location.branch_name}`
                                        : ''}
                                </option>
                            ))}
                        </select>
                    )}
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
                                        Stock Location
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
                                            <LocationCell item={item} />
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
