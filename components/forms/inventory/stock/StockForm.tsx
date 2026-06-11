'use client';
import { usePageActions } from '@/hook/usePageAction';
import { BranchProps } from '@/types/branch';
import { InventoryItemProps } from '@/types/inventory/item';
import { resolveHref } from '@/utils/utils';
import {
    MapPin,
    Package,
    Percent,
    RotateCcw,
    Search,
    ShieldCheck,
    AlertTriangle,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState } from 'react';

interface Props {
    items: Array<InventoryItemProps>;
}

// ─── Condition Badge ──────────────────────────────────────────────────────────
function ConditionBadge({ condition }: { condition?: string }) {
    switch (condition) {
        case 'used':
            return (
                <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 border border-amber-200">
                    មួយទឹក
                </span>
            );
        case 'refurbished':
            return (
                <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 border border-blue-200">
                    Refurbished
                </span>
            );
        default:
            return (
                <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                    ថ្មី
                </span>
            );
    }
}

// ─── Stock Qty Cell ───────────────────────────────────────────────────────────
function StockQtyCell({ item }: { item: InventoryItemProps }) {
    const extItem = item;

    if (item.item_class !== 'stock') {
        return <span className="text-xs text-slate-300">—</span>;
    }

    // Get total stock from balances or fallback
    let totalStock = 0;
    if (item.stock_balances && item.stock_balances.length > 0) {
        totalStock = item.stock_balances.reduce(
            (sum, b) => sum + Number(b.quantity ?? 0),
            0,
        );
    } else if (typeof item.stock === 'number') {
        totalStock = item.stock;
    } else if (item.stock && typeof item.stock === 'object') {
        totalStock = (item.stock as any).stock_onhand ?? 0;
    }

    const minStock = extItem.min_stock;
    const isLow = minStock != null && minStock > 0 && totalStock <= minStock;
    const isZero = totalStock === 0;

    return (
        <div className="flex items-center gap-1.5">
            <span
                className={`font-mono text-sm font-bold ${
                    isZero
                        ? 'text-red-500'
                        : isLow
                          ? 'text-amber-600'
                          : 'text-slate-800'
                }`}
            >
                {totalStock}
            </span>
            {isZero && (
                <span className="rounded bg-red-100 px-1.5 py-0.5 text-[9px] font-bold text-red-600">
                    OUT
                </span>
            )}
            {!isZero && isLow && (
                <AlertTriangle size={13} className="text-amber-500" />
            )}
        </div>
    );
}

// ─── Property Badges ──────────────────────────────────────────────────────────
function PropertyBadges({ item }: { item: InventoryItemProps }) {
    const badges = [];

    if (item.has_warranty) {
        badges.push(
            <span
                key="w"
                title="Warranty"
                className="flex h-5 w-5 items-center justify-center rounded-md bg-blue-50 text-blue-500"
            >
                <ShieldCheck size={11} />
            </span>,
        );
    }
    if (item.is_discount) {
        badges.push(
            <span
                key="d"
                title="Discountable"
                className="flex h-5 w-5 items-center justify-center rounded-md bg-purple-50 text-purple-500"
            >
                <Percent size={11} />
            </span>,
        );
    }
    if (item.is_returnable) {
        badges.push(
            <span
                key="r"
                title="Returnable"
                className="flex h-5 w-5 items-center justify-center rounded-md bg-amber-50 text-amber-500"
            >
                <RotateCcw size={11} />
            </span>,
        );
    }

    if (badges.length === 0) return null;

    return <div className="mt-1 flex items-center gap-1">{badges}</div>;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function StockForm({
    items,
}: {
    items: Array<InventoryItemProps>;
}) {
    const [searchQuery, setSearchQuery] = useState('');
    const [filterBranchId, setFilterBranchId] = useState<number | 'all'>('all');
    const [filterLocationId, setFilterLocationId] = useState<number | 'all'>(
        'all',
    );
    const [filterCondition, setFilterCondition] = useState<string>('all');
    const pageAction = usePageActions();
    const [deletingId, setDeletingId] = useState<number | null>(null);

    const staticActions = pageAction?.actions.filter((a) => !a.dynamic) ?? [];
    const dynamicActions = pageAction?.actions.filter((a) => a.dynamic) ?? [];

    const filteredItems = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();

        return items.filter((item) => {
            const matchesSearch =
                !q ||
                item.name.toLowerCase().includes(q) ||
                (item.reference_no ?? '').toLowerCase().includes(q) ||
                (item.category?.name ?? '').toLowerCase().includes(q) ||
                (item.brand ?? '').toLowerCase().includes(q);

            const matchesLocation =
                filterLocationId === 'all' ||
                item.stock_location?.location_id === filterLocationId ||
                item.stock_balances?.some(
                    (balance) => balance.location_id === filterLocationId,
                );

            const matchesCondition =
                filterCondition === 'all' ||
                (item.condition ?? 'new') === filterCondition;

            return matchesSearch && matchesLocation && matchesCondition;
        });
    }, [filterLocationId, filterCondition, items, searchQuery]);

    // Stats
    const totalItems = filteredItems.length;
    const lowStockCount = filteredItems.filter((item) => {
        if (item.item_class !== 'stock') return false;
        let total = 0;
        if (item.stock_balances?.length) {
            total = item.stock_balances.reduce(
                (s, b) => s + Number(b.quantity ?? 0),
                0,
            );
        } else if (typeof item.stock === 'number') {
            total = item.stock;
        }
        return (
            item.min_stock != null &&
            item.min_stock > 0 &&
            total <= item.min_stock
        );
    }).length;

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
                {/* Search & Filters */}
                <div className="mb-6 flex flex-wrap items-center gap-3">
                    <div className="relative min-w-60 max-w-md flex-1">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <Search size={18} className="text-gray-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search by name, SKU, brand..."
                            className="block w-full pl-11 pr-4 py-2.5 border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm transition-all"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    {/* Condition filter */}
                    <select
                        value={filterCondition}
                        onChange={(e) => setFilterCondition(e.target.value)}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    >
                        <option value="all">All Conditions</option>
                        <option value="new">ថ្មី (New)</option>
                        <option value="used">មួយទឹក (Used)</option>
                        <option value="refurbished">Refurbished</option>
                    </select>
                </div>

                {/* Stats bar */}
                <div className="mb-4 flex items-center gap-4 text-xs text-slate-500">
                    {lowStockCount > 0 && (
                        <span className="flex items-center gap-1 text-amber-600">
                            <AlertTriangle size={12} />
                            ស្តុកទាប:{' '}
                            <span className="font-bold">{lowStockCount}</span>
                        </span>
                    )}
                </div>

                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden relative">
                    <div className="overflow-x-auto">
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
                                        Brand
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                        Category
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                        Condition
                                    </th>

                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                        Pricing{' '}
                                    </th>
                                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-100">
                                {filteredItems.map((item) => {
                                    return (
                                        <tr
                                            key={item.id}
                                            className="hover:bg-gray-50/80 transition-colors"
                                        >
                                            {/* Reference */}
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-2.5 py-1 rounded">
                                                    {item.reference_no || '—'}
                                                </span>
                                            </td>

                                            {/* Item Name + Image + Properties */}
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-start gap-3">
                                                    {item.images_url &&
                                                    item.images_url.length >
                                                        0 ? (
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
                                                            <Package
                                                                size={20}
                                                            />
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
                                                        <PropertyBadges
                                                            item={item}
                                                        />
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Brand */}
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="text-xs font-medium text-gray-700">
                                                    {item.brand || '—'}
                                                </span>
                                            </td>

                                            {/* Category */}
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="text-xs font-medium text-gray-700">
                                                    {item.category?.name ?? ''}
                                                </span>
                                            </td>

                                            {/* Condition */}
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <ConditionBadge
                                                    condition={
                                                        item.condition as string
                                                    }
                                                />
                                            </td>

                                            {/* Sale Price */}
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="text-sm font-semibold text-gray-900">
                                                    $
                                                    {(
                                                        item.price ??
                                                        item.sale_price ??
                                                        0
                                                    ).toFixed(2)}
                                                </span>
                                                {(item.min_price != null ||
                                                    item.max_price != null) && (
                                                    <div className="mt-0.5 text-[10px] text-slate-400">
                                                        {item.min_price !=
                                                            null && (
                                                            <>
                                                                Min: $
                                                                {Number(
                                                                    item.min_price,
                                                                ).toFixed(2)}
                                                            </>
                                                        )}
                                                        {item.min_price !=
                                                            null &&
                                                            item.max_price !=
                                                                null &&
                                                            ' · '}
                                                        {item.max_price !=
                                                            null && (
                                                            <>
                                                                Max: $
                                                                {Number(
                                                                    item.max_price,
                                                                ).toFixed(2)}
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                            </td>

                                            {/* Actions */}
                                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {dynamicActions.map(
                                                        (action) => {
                                                            const Icon =
                                                                action.icon;
                                                            const href =
                                                                resolveHref(
                                                                    action.href as string,
                                                                    Number(
                                                                        item.id,
                                                                    ),
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
                                                                    {
                                                                        action.label
                                                                    }
                                                                </Link>
                                                            );
                                                        },
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
