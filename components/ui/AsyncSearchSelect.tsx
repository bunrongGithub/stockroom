'use client';

import { Search, ChevronDown, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { FieldLabel } from './FieldLabel';

type Option = {
    value: string | number;
    label: string;
};

type AsyncSearchSelectProps = {
    label: string;
    placeholder?: string;
    apiUrl: string;

    /** Pass the selected item's ID here (not the name). */
    value: string | number | null;
    /** Returns the full selected option so callers can grab both id and name. */
    onChange: (
        selected: { id: string | number | null; name: string } | null,
    ) => void;

    required?: boolean;
};

export default function AsyncSearchSelect({
    label,
    placeholder = 'Search...',
    apiUrl,
    value,
    onChange,
    required,
}: AsyncSearchSelectProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [options, setOptions] = useState<Option[]>([]);
    // Keep the display label separately so it survives options list changes
    const [selectedLabel, setSelectedLabel] = useState<string>('');

    // ───────────────── Fetch Data ─────────────────
    const fetchOptions = async (keyword = '') => {
        try {
            setLoading(true);
            const res = await fetch(
                `${apiUrl}?search=${encodeURIComponent(keyword)}`,
            );
            if (!res.ok) throw new Error('Failed to fetch');

            const data = await res.json();
            const items = Array.isArray(data)
                ? data
                : Array.isArray(data.results)
                  ? data.results
                  : Array.isArray(data.data)
                    ? data.data
                    : [];

            setOptions(
                items.map((item: any) => ({
                    value: item.id,
                    label: item.name,
                })),
            );
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    // ───────────────── Open Dropdown ─────────────────
    const handleOpen = () => {
        setOpen(true);
        if (options.length === 0) fetchOptions();
    };

    // ───────────────── Debounced Search ─────────────────
    useEffect(() => {
        if (!open) return;
        const timeout = setTimeout(() => fetchOptions(search), 300);
        return () => clearTimeout(timeout);
    }, [search, open]);

    // ───────────────── Close on Outside Click ─────────────────
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (
                containerRef.current &&
                !containerRef.current.contains(e.target as Node)
            ) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () =>
            document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (option: Option) => {
        setSelectedLabel(option.label);
        onChange({ id: option.value, name: option.label });
        setOpen(false);
        setSearch('');
    };

    return (
        <div className="relative" ref={containerRef}>
            <FieldLabel>{label}</FieldLabel>

            {/* Trigger button */}
            <button
                type="button"
                onClick={handleOpen}
                className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
                <span
                    className={
                        selectedLabel ? 'text-slate-700' : 'text-slate-400'
                    }
                >
                    {selectedLabel || placeholder}
                </span>
                <ChevronDown size={18} className="text-slate-400" />
            </button>

            {/* Dropdown */}
            <div
                className={`absolute z-50 mt-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg transition-all duration-200 ${
                    open
                        ? 'visible translate-y-0 opacity-100'
                        : 'invisible -translate-y-1 opacity-0'
                }`}
            >
                {/* Search input */}
                <div className="border-b border-slate-100 p-2">
                    <div className="relative">
                        <input
                            autoFocus
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search..."
                            className="w-full rounded-lg border border-slate-200 py-2 pl-3 pr-10 text-sm focus:border-[#1a9e52] focus:outline-none focus:ring-2 focus:ring-[#1a9e52]/20"
                        />
                        <Search
                            size={16}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                        />
                    </div>
                </div>

                {/* Options list */}
                <div className="max-h-60 overflow-y-auto">
                    {loading ? (
                        <div className="flex items-center justify-center py-6">
                            <Loader2
                                size={18}
                                className="animate-spin text-slate-400"
                            />
                        </div>
                    ) : options.length === 0 ? (
                        <div className="py-4 text-center text-sm text-slate-400">
                            No data found
                        </div>
                    ) : (
                        options.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => handleSelect(option)}
                                className={`flex w-full items-center px-4 py-3 text-left text-sm transition-colors hover:bg-slate-50 ${
                                    String(option.value) === String(value ?? '')
                                        ? 'bg-[#1a9e52]/5 font-medium text-[#1a9e52]'
                                        : 'text-slate-700'
                                }`}
                            >
                                {option.label}
                            </button>
                        ))
                    )}
                </div>
            </div>

            {/* Hidden input for native form required validation */}
            {required && (
                <input
                    type="hidden"
                    value={value ?? ''}
                    required
                    readOnly
                    aria-hidden="true"
                />
            )}
        </div>
    );
}
