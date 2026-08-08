'use client';

/**
 * EntityLookup — the ERP's searchable record picker.
 *
 * Built for the way people actually work: type any identifier you happen to
 * have (code, name, phone), scroll as far as you need, pick with the keyboard,
 * and create the record inline when it turns out not to exist yet. Recently
 * picked records surface first on an empty box, because the same handful of
 * partners come back all day.
 *
 * Entity-agnostic: pass an endpoint and a row renderer. Business Partner is the
 * first consumer; Purchasing, CRM and Accounting reuse it unchanged.
 */

import { useInfiniteQuery } from '@/hook/useInfiniteQuery';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { Loader2, Plus, Search, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

const RECENTS_LIMIT = 5;

function recentsKey(scope: string) {
    return `erp_lookup_recent_${scope}`;
}

function readRecents<T>(scope: string): T[] {
    if (typeof window === 'undefined') return [];
    try {
        const raw = window.localStorage.getItem(recentsKey(scope));
        return raw ? (JSON.parse(raw) as T[]) : [];
    } catch {
        return [];
    }
}

function writeRecent<T extends { id: number }>(scope: string, item: T) {
    if (typeof window === 'undefined') return;
    try {
        const next = [
            item,
            ...readRecents<T>(scope).filter((r) => r.id !== item.id),
        ].slice(0, RECENTS_LIMIT);
        window.localStorage.setItem(recentsKey(scope), JSON.stringify(next));
    } catch {
        // A full or blocked localStorage must never break a sale.
    }
}

export type EntityLookupProps<T extends { id: number }> = {
    /** Paginated endpoint speaking ?search=&page=&limit=. */
    endpoint: string;
    /** Static filters, e.g. { role: 'customer' }. */
    params?: Record<string, string | number | undefined>;
    /** Namespace for the recent-selection list. */
    recentsScope: string;
    value: T | null;
    onSelect: (item: T | null) => void;
    /** Row body inside the option button. */
    renderRow: (item: T, active: boolean) => React.ReactNode;
    /** Label for the closed control when something is selected. */
    renderValue?: (item: T) => React.ReactNode;
    label?: string;
    placeholder?: string;
    required?: boolean;
    disabled?: boolean;
    autoFocus?: boolean;
    /** Inline "create" affordance shown when a search finds nothing. */
    onCreateNew?: (typed: string) => void;
    createLabel?: string;
    emptyText?: string;
    className?: string;
};

export default function EntityLookup<T extends { id: number }>({
    endpoint,
    params,
    recentsScope,
    value,
    onSelect,
    renderRow,
    renderValue,
    label,
    placeholder = 'Search…',
    required,
    disabled,
    autoFocus,
    onCreateNew,
    createLabel = 'Create new',
    emptyText = 'No matches',
    className = '',
}: EntityLookupProps<T>) {
    const [open, setOpen] = useState(false);
    const [term, setTerm] = useState('');
    const [active, setActive] = useState(0);
    const [recents, setRecents] = useState<T[]>([]);
    const boxRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLUListElement>(null);
    const sentinelRef = useRef<HTMLLIElement>(null);

    const { items, loading, hasMore, loadMore } = useInfiniteQuery<T>({
        endpoint,
        search: term,
        params,
        enabled: open,
    });

    // An empty box shows what you picked last — the fast path for regulars.
    const options = term.trim() === '' && recents.length > 0 && items.length === 0
        ? recents
        : items;

    const openList = useCallback(() => {
        // Refresh recents each time the list opens so a pick made elsewhere in
        // the session is reflected without a reload.
        setRecents(readRecents<T>(recentsScope));
        setOpen(true);
    }, [recentsScope]);

    // Close on an outside click.
    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => {
            if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', onDown);
        return () => document.removeEventListener('mousedown', onDown);
    }, [open]);

    // Infinite scroll: fetch the next page as the sentinel enters the list.
    useEffect(() => {
        if (!open || !hasMore) return;
        const node = sentinelRef.current;
        if (!node) return;
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0]?.isIntersecting) loadMore();
            },
            { root: listRef.current, rootMargin: '80px' },
        );
        observer.observe(node);
        return () => observer.disconnect();
    }, [open, hasMore, loadMore, options.length]);

    const choose = useCallback(
        (item: T) => {
            onSelect(item);
            writeRecent(recentsScope, item);
            setRecents(readRecents<T>(recentsScope));
            setOpen(false);
            setTerm('');
        },
        [onSelect, recentsScope],
    );

    function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((i) => Math.min(i + 1, options.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const picked = options[active];
            if (picked) choose(picked);
            else if (onCreateNew && term.trim()) onCreateNew(term.trim());
        } else if (e.key === 'Escape') {
            e.preventDefault();
            setOpen(false);
        }
    }

    // Keep the highlighted row in view during keyboard navigation.
    useEffect(() => {
        if (!open) return;
        const list = listRef.current;
        const el = list?.querySelector<HTMLElement>(`[data-idx="${active}"]`);
        el?.scrollIntoView({ block: 'nearest' });
    }, [active, open]);

    return (
        <div className={className} ref={boxRef}>
            {label && <FieldLabel required={required}>{label}</FieldLabel>}

            {value && !open ? (
                <div className="flex min-h-11.5 items-center justify-between gap-2 rounded-xl border border-[#1a9e52]/40 bg-emerald-50/50 px-4 py-3">
                    <span className="min-w-0 flex-1">
                        {renderValue ? renderValue(value) : renderRow(value, false)}
                    </span>
                    {!disabled && (
                        <span className="flex shrink-0 gap-1">
                            <button
                                type="button"
                                onClick={() => {
                                    openList();
                                    setTimeout(() => inputRef.current?.focus(), 0);
                                }}
                                className="rounded-lg px-2 py-1 text-[10px] text-[#1a9e52] hover:bg-emerald-100"
                            >
                                Change
                            </button>
                            <button
                                type="button"
                                onClick={() => onSelect(null)}
                                aria-label="Clear selection"
                                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                            >
                                <X size={13} />
                            </button>
                        </span>
                    )}
                </div>
            ) : (
                <div className="relative">
                    <Search
                        size={14}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                        ref={inputRef}
                        value={term}
                        disabled={disabled}
                        autoFocus={autoFocus}
                        onFocus={openList}
                        onChange={(e) => {
                            setTerm(e.target.value);
                            setActive(0);
                            openList();
                        }}
                        onKeyDown={onKeyDown}
                        placeholder={placeholder}
                        role="combobox"
                        aria-expanded={open}
                        aria-controls="entity-lookup-list"
                        className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-9 text-sm shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-50"
                    />
                    {loading && (
                        <Loader2
                            size={14}
                            className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400"
                        />
                    )}

                    {open && (
                        <ul
                            id="entity-lookup-list"
                            ref={listRef}
                            role="listbox"
                            className="absolute z-40 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
                        >
                            {term.trim() === '' && recents.length > 0 && items.length === 0 && (
                                <li className="px-3 py-1 text-[10px] uppercase tracking-wider text-slate-400">
                                    Recent
                                </li>
                            )}

                            {options.map((item, i) => (
                                <li key={item.id} data-idx={i}>
                                    <button
                                        type="button"
                                        role="option"
                                        aria-selected={i === active}
                                        onMouseEnter={() => setActive(i)}
                                        onClick={() => choose(item)}
                                        className={`w-full px-3 py-2 text-left transition-colors ${
                                            i === active ? 'bg-emerald-50' : 'hover:bg-slate-50'
                                        }`}
                                    >
                                        {renderRow(item, i === active)}
                                    </button>
                                </li>
                            ))}

                            {hasMore && (
                                <li
                                    ref={sentinelRef}
                                    className="flex justify-center py-2 text-[10px] text-slate-400"
                                >
                                    {loading ? 'Loading…' : 'Scroll for more'}
                                </li>
                            )}

                            {!loading && options.length === 0 && (
                                <li className="px-3 py-3 text-center text-slate-400">
                                    {emptyText}
                                </li>
                            )}

                            {onCreateNew && (
                                <li className="border-t border-slate-100">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onCreateNew(term.trim());
                                            setOpen(false);
                                        }}
                                        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[#1a9e52] transition-colors hover:bg-emerald-50"
                                    >
                                        <Plus size={13} />
                                        {term.trim() ? `${createLabel}: "${term.trim()}"` : createLabel}
                                    </button>
                                </li>
                            )}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}
