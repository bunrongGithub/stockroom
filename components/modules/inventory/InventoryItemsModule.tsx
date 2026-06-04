'use client';

import type { ModuleProps } from '@/lib/module-registry';
import { useEffect, useState } from 'react';
import { Package, Plus, Search } from 'lucide-react';
import Link from 'next/link';

interface Item {
    id: number;
    name: string;
    sku: string | null;
    item_class: string;
    price: number;
    is_sellable: boolean;
}

export default function InventoryItemsModule({ permission }: ModuleProps) {
    const [items, setItems] = useState<Item[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        fetch(`/api/inventory?search=${encodeURIComponent(search)}&limit=50`)
            .then((r) => (r.ok ? r.json() : { data: [] }))
            .then((json) => setItems(json.data ?? []))
            .catch(() => setItems([]))
            .finally(() => setIsLoading(false));
    }, [search]);

    return (
        <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Package size={20} className="text-emerald-500" />
                    <h1 className="text-lg font-bold text-gray-900">Inventory Items</h1>
                </div>
                {permission.can_create && (
                    <Link
                        href="/inventory/items/new"
                        className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
                    >
                        <Plus size={15} />
                        Add Item
                    </Link>
                )}
            </div>

            <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search items..."
                    className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
                />
            </div>

            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-gray-100 bg-gray-50">
                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">SKU</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Class</th>
                            <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Price</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {isLoading ? (
                            <tr>
                                <td colSpan={4} className="px-4 py-8 text-center text-gray-400 text-sm">
                                    Loading...
                                </td>
                            </tr>
                        ) : items.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-4 py-8 text-center text-gray-400 text-sm">
                                    No items found
                                </td>
                            </tr>
                        ) : (
                            items.map((item) => (
                                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-4 py-3 font-medium text-gray-800">{item.name}</td>
                                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">{item.sku ?? '—'}</td>
                                    <td className="px-4 py-3">
                                        <span className="px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-600 font-medium">
                                            {item.item_class}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right font-medium text-gray-800">
                                        {Number(item.price).toFixed(2)}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
