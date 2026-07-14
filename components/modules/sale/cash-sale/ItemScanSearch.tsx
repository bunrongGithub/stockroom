'use client';

import { API } from '@/lib/constant';
import { Loader2, ScanLine } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * The register's item entry: a single always-focused field that works for both
 * a barcode scanner and a keyboard.
 *
 * A scanner types the code and presses Enter, so Enter adds the exact SKU/name
 * match (or the only result) without a click. A cashier typing a name gets a
 * live list and picks with ↑/↓ + Enter, or the mouse. Search is server-side and
 * limited to SELLABLE stock items — the register never offers something that is
 * not for sale.
 */

type ItemRow = { id: number; name: string; sku: string | null };

export default function ItemScanSearch({
    onSelect,
    disabled,
}: {
    onSelect: (itemId: number) => void;
    disabled?: boolean;
}) {
    const [term, setTerm] = useState('');
    const [rows, setRows] = useState<ItemRow[]>([]);
    const [active, setActive] = useState(0);
    const [loading, setLoading] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

    // The counter's default state is "ready for the next scan".
    useEffect(() => {
        if (!disabled) inputRef.current?.focus();
    }, [disabled]);

    const search = useCallback(async (keyword: string): Promise<ItemRow[]> => {
        const url = new URL(API.inventory.stockItem.root, window.location.origin);
        url.searchParams.set('sellable', 'true');
        url.searchParams.set('limit', '8');
        if (keyword) url.searchParams.set('search', keyword);
        const res = await fetch(url.toString());
        if (!res.ok) return [];
        const json = await res.json();
        return (json.data ?? []) as ItemRow[];
    }, []);

    // Debounced lookup. A scanner fills the field in one burst, so the list is
    // usually only a fallback for the Enter-key resolution below.
    useEffect(() => {
        if (debounce.current) clearTimeout(debounce.current);
        debounce.current = setTimeout(async () => {
            const keyword = term.trim();
            if (!keyword) {
                setRows([]);
                setLoading(false);
                return;
            }
            setLoading(true);
            const found = await search(keyword);
            setRows(found);
            setActive(0);
            setLoading(false);
        }, 200);
        return () => {
            if (debounce.current) clearTimeout(debounce.current);
        };
    }, [term, search]);

    const pick = (item: ItemRow) => {
        onSelect(item.id);
        setTerm('');
        setRows([]);
        inputRef.current?.focus();
    };

    const onKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((i) => Math.min(i + 1, rows.length - 1));
            return;
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
            return;
        }
        if (e.key === 'Escape') {
            setTerm('');
            setRows([]);
            return;
        }
        if (e.key !== 'Enter') return;

        e.preventDefault();
        const keyword = term.trim();
        if (!keyword) return;

        // A scanner fires Enter faster than the debounce: resolve the code
        // against the server rather than against whatever is on screen.
        const candidates = rows.length ? rows : await search(keyword);
        const exact = candidates.find(
            (r) =>
                r.sku?.toLowerCase() === keyword.toLowerCase() ||
                r.name.toLowerCase() === keyword.toLowerCase(),
        );
        const chosen =
            exact ??
            (candidates.length === 1 ? candidates[0] : candidates[active]);
        if (chosen) pick(chosen);
    };

    return (
        <div className="relative">
            <div className="relative">
                <ScanLine
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[#1a9e52]"
                />
                <input
                    ref={inputRef}
                    value={term}
                    disabled={disabled}
                    onChange={(e) => setTerm(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder="Scan barcode or type an item name…"
                    aria-label="Scan or search item"
                    className="w-full rounded-xl border border-slate-200 bg-white py-3.5 pl-10 pr-10 text-sm shadow-sm transition focus:border-[#1a9e52] focus:outline-none focus:ring-2 focus:ring-[#1a9e52]/20 disabled:bg-slate-50"
                />
                {loading && (
                    <Loader2
                        size={16}
                        className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400"
                    />
                )}
            </div>

            {rows.length > 0 && (
                <ul className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                    {rows.map((row, i) => (
                        <li key={row.id}>
                            <button
                                type="button"
                                onMouseEnter={() => setActive(i)}
                                onClick={() => pick(row)}
                                className={`flex w-full items-center justify-between px-3 py-2.5 text-left text-sm ${
                                    i === active
                                        ? 'bg-emerald-50 text-[#1a9e52]'
                                        : 'text-slate-700 hover:bg-slate-50'
                                }`}
                            >
                                <span className="truncate">{row.name}</span>
                                <span className="ml-3 shrink-0 text-xs text-slate-400">
                                    {row.sku ?? ''}
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
