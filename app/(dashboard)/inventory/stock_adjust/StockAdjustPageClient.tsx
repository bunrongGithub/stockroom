'use client';

import StockAdjustForm from '@/components/forms/inventory/stock/StockAdjustForm';
import { InventoryItemProps } from '@/types/inventory/item';
import { Package, Search, SlidersHorizontal } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface Props {
    items: InventoryItemProps[];
}

export default function StockAdjustPageClient({ items }: Props) {
    const router = useRouter();

    const [search, setSearch] = useState('');
    const [activeItemId, setActiveItemId] = useState<number | null>(null);

    const [toast, setToast] = useState<{
        msg: string;
        type: 'success' | 'error';
    } | null>(null);

    const showToast = (msg: string, type: 'success' | 'error') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const filtered = items.filter(
        (item) =>
            item.name.toLowerCase().includes(search.toLowerCase()) ||
            (item.reference_no ?? '').toLowerCase().includes(search.toLowerCase()),
    );

    return (
        <>
            {/* ── Toast ── */}
            {toast && (
                <div
                    className={`fixed right-4 top-4 z-[60] rounded-xl px-4 py-3 text-sm font-medium shadow-lg transition-all ${
                        toast.type === 'success'
                            ? 'bg-emerald-500 text-white'
                            : 'bg-rose-500 text-white'
                    }`}
                >
                    {toast.msg}
                </div>
            )}

            {/* ── Modal ── */}
            {activeItemId !== null && (
                <StockAdjustForm
                    itemId={activeItemId}
                    onClose={() => setActiveItemId(null)}
                    onSuccess={() => {
                        showToast('Stock adjusted successfully.', 'success');
                        router.refresh();
                    }}
                />
            )}

            {/* ── Page body ── */}
            <div className="mx-auto space-y-8 animate-in fade-in duration-500 p-4 md:p-8">

                {/* Header */}
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div>
                        <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
                            <SlidersHorizontal className="text-blue-600" />
                            Stock Adjustment
                        </h2>
                        <p className="mt-1 text-sm text-slate-500">
                            ជ្រើសរើស​ទំនិញ​ដើម្បីកែ​សម្រួល​បរិមាណ​ស្តុក
                        </p>
                    </div>

                    {/* Search */}
                    <div className="relative max-w-sm w-full">
                        <Search
                            size={16}
                            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                        />
                        <input
                            type="text"
                            placeholder="Search by name or reference…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                    </div>
                </div>

                {/* Table card */}
                <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-100">
                            <thead className="bg-slate-50">
                                <tr>
                                    {['Reference', 'Item', 'Category', 'UOM', 'Current Stock', 'Action'].map(
                                        (h, i) => (
                                            <th
                                                key={h}
                                                className={`px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-600 ${
                                                    i === 5 ? 'text-right' : 'text-left'
                                                }`}
                                            >
                                                {h}
                                            </th>
                                        ),
                                    )}
                                </tr>
                            </thead>

                            <tbody className="divide-y divide-slate-100 bg-white">
                                {filtered.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={6}
                                            className="py-16 text-center text-sm text-slate-400"
                                        >
                                            No stock items found.
                                        </td>
                                    </tr>
                                ) : (
                                    filtered.map((item) => (
                                        <tr
                                            key={item.id}
                                            className="transition-colors hover:bg-gray-50/80"
                                        >
                                            {/* Reference */}
                                            <td className="whitespace-nowrap px-6 py-4">
                                                <span className="rounded bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">
                                                    {item.reference_no || '—'}
                                                </span>
                                            </td>

                                            {/* Name + image */}
                                            <td className="whitespace-nowrap px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    {item.images_url?.length ? (
                                                        <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-gray-200">
                                                            <Image
                                                                src={item.images_url[0]}
                                                                alt={item.name}
                                                                width={36}
                                                                height={36}
                                                                className="h-full w-full object-cover"
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-gray-100 text-gray-400">
                                                            <Package size={16} />
                                                        </div>
                                                    )}
                                                    <span className="text-sm font-semibold text-gray-900">
                                                        {item.name}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Category */}
                                            <td className="whitespace-nowrap px-6 py-4 text-xs font-medium text-gray-700">
                                                {item.category?.name ?? '—'}
                                            </td>

                                            {/* UOM */}
                                            <td className="whitespace-nowrap px-6 py-4 text-xs font-medium text-gray-700">
                                                {item.uom?.name ?? '—'}
                                            </td>

                                            {/* Current stock */}
                                            <td className="whitespace-nowrap px-6 py-4">
                                                <span className="text-sm font-bold text-emerald-700">
                                                    {(item as any).stock ?? 0}
                                                </span>
                                                <span className="ml-1 text-xs text-slate-400">
                                                    {item.uom?.name ?? 'units'}
                                                </span>
                                            </td>

                                            {/* Action */}
                                            <td className="whitespace-nowrap px-6 py-4 text-right">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setActiveItemId(Number(item.id))
                                                    }
                                                    className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50"
                                                >
                                                    <SlidersHorizontal size={12} />
                                                    Adjust Stock
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer count */}
                    <div className="border-t border-slate-100 bg-slate-50 px-6 py-2.5">
                        <p className="text-[11px] text-slate-400">
                            {filtered.length} item{filtered.length !== 1 ? 's' : ''}
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
}