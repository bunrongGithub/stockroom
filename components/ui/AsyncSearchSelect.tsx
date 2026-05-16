'use client';

import { Search, ChevronDown, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

type Option = {
    value: string | number;
    label: string;
};

type AsyncSearchSelectProps = {
    label: string;
    placeholder?: string;
    apiUrl: string;

    value: string | number;
    onChange: (value: string | number) => void;

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

    const selectedOption = options.find(
        (item) => String(item.value) === String(value),
    );

    // ───────────────── Fetch Data ─────────────────
    const fetchOptions = async (keyword = '') => {
        try {
            setLoading(true);

            const res = await fetch(
                `${apiUrl}?search=${encodeURIComponent(keyword)}`,
            );

            if (!res.ok) {
                throw new Error('Failed to fetch');
            }
            const data = await res.json();

            const items = Array.isArray(data)
                ? data
                : Array.isArray(data.results)
                  ? data.results
                  : Array.isArray(data.data)
                    ? data.data
                    : [];

            const mapped = items.map((item: any) => ({
                value: item.id,
                label: item.name,
            }));

            setOptions(mapped);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    // ───────────────── Open Dropdown ─────────────────
    const handleOpen = async () => {
        setOpen(true);

        if (options.length === 0) {
            await fetchOptions();
        }
    };

    // ───────────────── Search ─────────────────
    useEffect(() => {
        if (!open) return;

        const timeout = setTimeout(() => {
            fetchOptions(search);
        }, 300);

        return () => clearTimeout(timeout);
    }, [search]);

    // ───────────────── Close Outside ─────────────────
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                containerRef.current &&
                !containerRef.current.contains(event.target as Node)
            ) {
                setOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    return (
        <div className="relative" ref={containerRef}>
            {/* Label */}
            <label className="mb-1 block text-sm font-medium text-slate-700">
                {label}
            </label>

            {/* Input */}
            <button
                type="button"
                onClick={handleOpen}
                className="
                    flex w-full items-center justify-between
                    rounded-xl border border-slate-200 bg-white
                    px-4 py-3 text-sm
                    focus:border-[#1a9e52]
                    focus:outline-none
                    focus:ring-2
                    focus:ring-[#1a9e52]/20
                "
            >
                <span
                    className={
                        selectedOption ? 'text-slate-700' : 'text-slate-400'
                    }
                >
                    {selectedOption?.label || placeholder}
                </span>

                <ChevronDown size={18} className="text-slate-400" />
            </button>

            {/* Dropdown */}
            <div
                className={`
                    absolute z-50 mt-2 w-full overflow-hidden
                    rounded-xl border border-slate-200 bg-white shadow-lg
                    transition-all duration-200
                    ${
                        open
                            ? 'visible opacity-100 translate-y-0'
                            : 'invisible opacity-0 -translate-y-1'
                    }
                `}
            >
                {/* Search */}
                <div className="border-b border-slate-100 p-2">
                    <div className="relative">
                        <input
                            autoFocus
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search..."
                            className="
                                w-full rounded-lg border border-slate-200
                                py-2 pl-3 pr-10 text-sm
                                focus:border-[#1a9e52]
                                focus:outline-none
                                focus:ring-2
                                focus:ring-[#1a9e52]/20
                            "
                        />

                        {/* Search Icon */}
                        <Search
                            size={16}
                            className="
                                absolute right-3 top-1/2
                                -translate-y-1/2 text-slate-400
                            "
                        />
                    </div>
                </div>

                {/* Options */}
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
                                onClick={() => {
                                    onChange(option.value);
                                    setOpen(false);
                                }}
                                className="
                                    flex w-full items-center px-4 py-3
                                    text-left text-sm text-slate-700
                                    hover:bg-slate-50
                                "
                            >
                                {option.label}
                            </button>
                        ))
                    )}
                </div>
            </div>

            {/* Hidden Input */}
            {required && (
                <input type="hidden" value={value} required readOnly />
            )}
        </div>
    );
}
