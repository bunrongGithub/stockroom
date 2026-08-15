'use client';

import { Loader2, X, Zap } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { API } from '@/lib/constant';
import SerialScannerInput from './SerialScannerInput';

// Select EXISTING serials (sales shipment; future: transfer, adjustment
// decrease, returns, RMA). Scales to 100k serials: the server does prefix
// search and returns at most `limit` rows + a total — the browser never loads
// the full set. Scanning validates the exact serial server-side; "Auto-fill"
// takes the oldest available (FIFO) to complete the required count.
// The posting service remains the final authority on validity.

type SerialRow = { id: number; serial_number: string; created_at: string };

const PAGE_LIMIT = 50;

async function fetchAvailable(params: {
    itemId: number;
    warehouseId: number;
    locationId: number;
    search?: string;
    limit?: number;
}): Promise<{ rows: SerialRow[]; total: number }> {
    const url = new URL(API.inventory.serial.root, window.location.origin);
    url.searchParams.set('item_id', String(params.itemId));
    url.searchParams.set('warehouse_id', String(params.warehouseId));
    url.searchParams.set('location_id', String(params.locationId));
    if (params.search) url.searchParams.set('search', params.search);
    if (params.limit) url.searchParams.set('limit', String(params.limit));
    const res = await fetch(url.toString());
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Failed to load serials');
    return { rows: json.data ?? [], total: json.total ?? 0 };
}

export default function SerialLookupPanel({
    itemId,
    warehouseId,
    locationId,
    requiredCount,
    value,
    onChange,
}: {
    itemId: number;
    warehouseId: number;
    locationId: number | null;
    requiredCount: number;
    value: string[];
    onChange: (serials: string[]) => void;
}) {
    const [rows, setRows] = useState<SerialRow[]>([]);
    const [total, setTotal] = useState(0);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const remaining = Math.max(requiredCount - value.length, 0);
    const complete = requiredCount > 0 && value.length === requiredCount;

    const loadList = useCallback(
        async (term: string) => {
            if (!locationId) {
                setRows([]);
                setTotal(0);
                return;
            }
            setLoading(true);
            try {
                const { rows: r, total: t } = await fetchAvailable({
                    itemId,
                    warehouseId,
                    locationId,
                    search: term || undefined,
                    limit: PAGE_LIMIT,
                });
                setRows(r);
                setTotal(t);
            } catch {
                setRows([]);
                setTotal(0);
            } finally {
                setLoading(false);
            }
        },
        [itemId, warehouseId, locationId],
    );

    // Initial load + reload when the location changes.
    useEffect(() => {
        setSearch('');
        loadList('');
        // Selections may no longer be valid for a different location.
        // (Parent decides; we only prune when location is cleared.)
        if (!locationId && value.length) onChange([]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [locationId, loadList]);

    // Debounced incremental search.
    function onSearchChange(term: string) {
        setSearch(term);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => loadList(term), 250);
    }

    function add(sn: string) {
        setError(null);
        if (value.includes(sn)) return setError(`${sn} is already selected.`);
        if (value.length >= requiredCount)
            return setError(`Already selected ${requiredCount} serial(s).`);
        onChange([...value, sn]);
    }

    function remove(sn: string) {
        setError(null);
        onChange(value.filter((s) => s !== sn));
    }

    /** Scan path: exact server validation in this warehouse+location. */
    async function handleScan(serials: string[]) {
        if (!locationId) return setError('Select a location first.');
        setError(null);
        for (const sn of serials) {
            if (value.includes(sn)) {
                setError(`${sn} is already selected.`);
                continue;
            }
            if (value.length >= requiredCount) {
                setError(`Already selected ${requiredCount} serial(s).`);
                break;
            }
            try {
                const { rows: matches } = await fetchAvailable({
                    itemId,
                    warehouseId,
                    locationId,
                    search: sn,
                    limit: 5,
                });
                const exact = matches.find(
                    (m) => m.serial_number.toUpperCase() === sn.toUpperCase(),
                );
                if (!exact) {
                    setError(`${sn} is not available in this location.`);
                    continue;
                }
                add(exact.serial_number);
            } catch {
                setError(`Could not verify ${sn}. Try again.`);
            }
        }
    }

    /** FIFO auto-assign: oldest available serials complete the count. */
    async function handleAutoFill() {
        if (!locationId || remaining <= 0) return;
        setBusy(true);
        setError(null);
        try {
            const { rows: oldest } = await fetchAvailable({
                itemId,
                warehouseId,
                locationId,
                limit: Math.min(remaining + value.length, 200),
            });
            const picked = oldest
                .map((r) => r.serial_number)
                .filter((sn) => !value.includes(sn))
                .slice(0, remaining);
            if (!picked.length) {
                setError('No more available serials in this location.');
            } else {
                onChange([...value, ...picked]);
            }
        } catch {
            setError('Auto-fill failed. Try again.');
        } finally {
            setBusy(false);
        }
    }

    if (!locationId) {
        return (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
                <p className="text-[11px] text-slate-500">
                    Select a location first to pick serial numbers.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-2 rounded-xl">
            <SerialScannerInput
                onCommit={handleScan}
                error={error}
                placeholder="Search…"
            />

            {/* Counter + auto-fill */}
            <div className="flex items-center justify-between gap-2">
                <span
                    className={`font-mono text-[11px] font-semibold tabular-nums ${complete ? 'text-emerald-600' : 'text-amber-600'}`}
                >
                    Selected {value.length} / {requiredCount}
                </span>
                {remaining > 0 && (
                    <button
                        type="button"
                        onClick={handleAutoFill}
                        disabled={busy}
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-white px-2 py-1 font-mono text-[10px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-50 disabled:opacity-60"
                    >
                        {busy ? (
                            <Loader2 size={10} className="animate-spin" />
                        ) : (
                            <Zap size={10} />
                        )}
                        Auto-fill {remaining} (oldest first)
                    </button>
                )}
            </div>

            {/* Selected chips */}
            {value.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {value.map((sn) => (
                        <span
                            key={sn}
                            className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-100 px-1.5 py-0.5 font-mono text-[11px] text-emerald-800"
                        >
                            {sn}
                            <button
                                type="button"
                                onClick={() => remove(sn)}
                                className="text-emerald-500 hover:text-rose-500"
                                aria-label={`Remove ${sn}`}
                            >
                                <X size={10} />
                            </button>
                        </span>
                    ))}
                </div>
            )}

            {/* Incremental search results */}
            {!complete && (
                <div className="rounded-lg border border-slate-200 bg-white">
                    <div className="flex items-center gap-2 border-b border-slate-100 px-2 py-1.5">
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => onSearchChange(e.target.value)}
                            placeholder="Filter available serials…"
                            autoComplete="off"
                            spellCheck={false}
                            className="w-full bg-transparent font-mono text-[11px] outline-none placeholder:text-slate-300"
                        />
                        {loading && (
                            <Loader2 size={11} className="animate-spin text-slate-300" />
                        )}
                    </div>
                    <div className="max-h-36 overflow-y-auto">
                        {rows.filter((r) => !value.includes(r.serial_number))
                            .length === 0 ? (
                            <p className="px-2 py-3 text-center font-mono text-[11px] text-slate-400">
                                {total === 0
                                    ? 'No available serials match.'
                                    : 'All listed serials are selected.'}
                            </p>
                        ) : (
                            rows
                                .filter((r) => !value.includes(r.serial_number))
                                .map((r) => (
                                    <button
                                        key={r.id}
                                        type="button"
                                        onClick={() => add(r.serial_number)}
                                        className="flex w-full items-center justify-between px-2 py-1.5 text-left font-mono text-[11px] text-slate-700 transition-colors hover:bg-emerald-50"
                                    >
                                        <span>{r.serial_number}</span>
                                        <span className="text-[10px] text-slate-400">
                                            {new Date(r.created_at).toLocaleDateString(
                                                'en-GB',
                                                { day: '2-digit', month: 'short' },
                                            )}
                                        </span>
                                    </button>
                                ))
                        )}
                    </div>
                    {total > rows.length && (
                        <p className="border-t border-slate-100 px-2 py-1 text-center font-mono text-[10px] text-slate-400">
                            Showing {rows.length} of {total.toLocaleString()} — keep
                            typing to narrow down.
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
