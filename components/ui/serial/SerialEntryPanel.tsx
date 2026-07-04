'use client';

import { X } from 'lucide-react';
import { useState } from 'react';
import SerialScannerInput from './SerialScannerInput';

// Capture NEW serials (goods receipt; future: adjustment increase, purchase
// return). Scan-first: the box stays focused, Enter/scan appends a chip,
// duplicates are rejected inline, bulk paste appends a whole batch. The list
// is a newest-first log in a fixed-height scroll area — never N form inputs.

export default function SerialEntryPanel({
    value,
    onChange,
    requiredCount,
}: {
    value: string[];
    onChange: (serials: string[]) => void;
    requiredCount: number;
}) {
    const [error, setError] = useState<string | null>(null);

    const remaining = Math.max(requiredCount - value.length, 0);
    const complete = requiredCount > 0 && value.length === requiredCount;
    const over = value.length > requiredCount;
    const pct =
        requiredCount > 0
            ? Math.min((value.length / requiredCount) * 100, 100)
            : 0;

    function handleCommit(serials: string[]) {
        setError(null);
        const existing = new Set(value.map((s) => s.toUpperCase()));
        const added: string[] = [];
        let dup: string | null = null;
        let overflow = false;

        for (const sn of serials) {
            const key = sn.toUpperCase();
            if (existing.has(key)) {
                dup = sn;
                continue;
            }
            if (value.length + added.length >= requiredCount) {
                overflow = true;
                continue;
            }
            existing.add(key);
            added.push(sn);
        }

        if (added.length) onChange([...value, ...added]);
        if (dup) setError(`${dup} already entered.`);
        else if (overflow)
            setError(`All ${requiredCount} serials already entered.`);
    }

    function remove(sn: string) {
        setError(null);
        onChange(value.filter((s) => s !== sn));
    }

    return (
        <div className="space-y-2 rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
            <SerialScannerInput
                onCommit={handleCommit}
                error={error}
                disabled={requiredCount <= 0}
                placeholder={
                    requiredCount <= 0
                        ? 'Enter a quantity first…'
                        : 'Scan or type serial, press Enter…'
                }
            />

            {/* Counter + progress */}
            <div className="flex items-center gap-3">
                <span
                    className={`font-mono text-[11px] font-semibold tabular-nums ${
                        complete
                            ? 'text-emerald-600'
                            : over
                              ? 'text-rose-600'
                              : 'text-amber-600'
                    }`}
                >
                    {value.length} / {requiredCount}
                </span>
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-slate-200">
                    <div
                        className={`h-full rounded-full transition-all ${complete ? 'bg-emerald-500' : 'bg-amber-400'}`}
                        style={{ width: `${pct}%` }}
                    />
                </div>
                {remaining > 0 && (
                    <span className="font-mono text-[10px] text-slate-400">
                        {remaining} to go
                    </span>
                )}
                {value.length > 0 && (
                    <button
                        type="button"
                        onClick={() => {
                            setError(null);
                            onChange([]);
                        }}
                        className="font-mono text-[10px] text-slate-400 hover:text-rose-500"
                    >
                        Clear all
                    </button>
                )}
            </div>

            {/* Newest-first chip log */}
            {value.length > 0 && (
                <div className="flex max-h-36 flex-wrap content-start gap-1.5 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2">
                    {[...value].reverse().map((sn) => (
                        <span
                            key={sn}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[11px] text-slate-700"
                        >
                            {sn}
                            <button
                                type="button"
                                onClick={() => remove(sn)}
                                className="text-slate-400 hover:text-rose-500"
                                aria-label={`Remove ${sn}`}
                            >
                                <X size={10} />
                            </button>
                        </span>
                    ))}
                </div>
            )}

            <p className="text-[10px] text-slate-400">
                Tip: barcode scanners work directly — each scan adds a serial.
                Paste a list (one per line) to add in bulk.
            </p>
        </div>
    );
}
