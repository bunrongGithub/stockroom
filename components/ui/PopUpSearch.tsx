'use client';

import { Loader2, Search, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

type SearchItem = {
    id: string | number;
    name: string;
};

type PopUpSearchProps = {
    open: boolean;
    title: string;
    apiUrl: string;
    selectedValue?: string | number | null;
    placeholder?: string;
    emptyMessage?: string;
    onClose: () => void;
    onSelect: (selected: { id: string | number; name: string }) => void;
};

export default function PopUpSearch({
    open,
    title,
    apiUrl,
    selectedValue,
    placeholder = 'ស្វែងរក...',
    emptyMessage = 'មិនមានទិន្នន័យ',
    onClose,
    onSelect,
}: PopUpSearchProps) {
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [items, setItems] = useState<SearchItem[]>([]);
    const [error, setError] = useState('');

    const modalTitle = useMemo(() => `ស្វែងរក ${title}`, [title]);

    useEffect(() => {
        if (!open) return;

        const controller = new AbortController();
        const timeout = window.setTimeout(async () => {
            try {
                setLoading(true);
                setError('');

                const response = await fetch(
                    `${apiUrl}?search=${encodeURIComponent(search)}&limit=20`,
                    { signal: controller.signal },
                );

                if (!response.ok) {
                    throw new Error('Failed to fetch search data');
                }

                const json = await response.json();
                const data = json?.data?.data ?? [];
                setItems(
                    data.map((item: Record<string, unknown>) => ({
                        id: String(item.id ?? ''),
                        name: String(item.name ?? ''),
                    })),
                );
            } catch (fetchError) {
                if (
                    fetchError instanceof Error &&
                    fetchError.name === 'AbortError'
                ) {
                    return;
                }

                setItems([]);
                setError('មិនអាចទាញយកទិន្នន័យស្វែងរកបានទេ។');
            } finally {
                setLoading(false);
            }
        }, 250);

        return () => {
            controller.abort();
            window.clearTimeout(timeout);
        };
    }, [apiUrl, open, search]);

    if (!open) {
        return null;
    }

    const handleClose = () => {
        setSearch('');
        setError('');
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-slate-900/45"
                onClick={handleClose}
            />

            <div className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
                <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
                    <div>
                        <h3 className="text-lg font-semibold text-slate-900">
                            {modalTitle}
                        </h3>
                        <p className="mt-1 text-sm text-slate-500">
                            ជ្រើសរើស {title} ពីបញ្ជីខាងក្រោម
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={handleClose}
                        className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                        aria-label="Close search popup"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="border-b border-slate-100 px-6 py-4">
                    <div className="relative">
                        <Search
                            size={18}
                            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                        />
                        <input
                            autoFocus
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder={placeholder}
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-700 outline-none transition focus:border-[#1a9e52] focus:bg-white focus:ring-4 focus:ring-[#1a9e52]/10"
                        />
                    </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2
                                size={20}
                                className="animate-spin text-slate-400"
                            />
                        </div>
                    ) : error ? (
                        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                            {error}
                        </div>
                    ) : items.length === 0 ? (
                        <div className="py-12 text-center text-sm text-slate-400">
                            {emptyMessage}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {items.map((item) => {
                                const isActive =
                                    String(item.id) ===
                                    String(selectedValue ?? '');

                                return (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => {
                                            onSelect(item);
                                            handleClose();
                                        }}
                                        className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm transition ${
                                            isActive
                                                ? 'border-[#1a9e52]/30 bg-[#1a9e52]/10 text-[#157845]'
                                                : 'border-transparent bg-slate-50 text-slate-700 hover:border-slate-200 hover:bg-white'
                                        }`}
                                    >
                                        <span className="font-medium">
                                            {item.name}
                                        </span>
                                        <span className="text-xs text-slate-400">
                                            #{item.id}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
