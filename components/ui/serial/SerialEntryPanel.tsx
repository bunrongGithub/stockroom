'use client';

import { FileUp, Loader2, Sparkles, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { API } from '@/lib/constant';
import SerialScannerInput from './SerialScannerInput';

// Capture NEW serials (goods receipt, adjustment increase; future: purchase
// return, manufacturing). Scan-first: the box stays focused, Enter/scan
// appends a chip, duplicates are rejected inline, bulk paste appends a whole
// batch. The list is a newest-first log in a fixed-height scroll area — never
// N form inputs.
//
// When `generate` is provided (item allows auto generation), a "Generate"
// button fills the remaining count from the Serial Management framework —
// numbers come from the company's configured strategy and stay editable
// chips until the document is posted. A CSV/TXT import feeds the same
// dedupe/overflow pipeline as paste.

export type SerialGenerateContext = {
    itemId: number;
    warehouseId?: number;
    /** Item's entry mode: 'auto' hides manual typing, 'both' allows either. */
    mode: 'manual' | 'auto' | 'both';
};

export default function SerialEntryPanel({
    value,
    onChange,
    requiredCount,
    generate,
}: {
    value: string[];
    onChange: (serials: string[]) => void;
    requiredCount: number;
    generate?: SerialGenerateContext;
}) {
    const [error, setError] = useState<string | null>(null);
    const [generating, setGenerating] = useState(false);
    const fileRef = useRef<HTMLInputElement | null>(null);
    const canGenerate = !!generate && generate.mode !== 'manual';
    const manualAllowed = !generate || generate.mode !== 'auto';

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

    /** Fill the remaining count from the serial framework's generator. */
    async function handleGenerate() {
        if (!generate || remaining <= 0 || generating) return;
        setGenerating(true);
        setError(null);
        try {
            const res = await fetch(API.inventory.serial.generate, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    item_id: generate.itemId,
                    warehouse_id: generate.warehouseId,
                    count: remaining,
                }),
            });
            const json = await res.json();
            if (!res.ok)
                throw new Error(json.error ?? 'Failed to generate serials');
            handleCommit((json.data?.serials ?? []) as string[]);
        } catch (e) {
            setError(
                e instanceof Error ? e.message : 'Failed to generate serials',
            );
        } finally {
            setGenerating(false);
        }
    }

    /** CSV/TXT import — same dedupe/overflow pipeline as scan and paste. */
    async function handleImportFile(file: File) {
        setError(null);
        const text = await file.text();
        const serials = text
            .split(/[\r\n,;\t]+/)
            .map((s) => s.trim())
            .filter(Boolean);
        if (!serials.length) {
            setError('The file contains no serial numbers.');
            return;
        }
        handleCommit(serials);
    }

    return (
        <div className="space-y-2 rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
            <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                    <SerialScannerInput
                        onCommit={handleCommit}
                        error={error}
                        disabled={requiredCount <= 0 || !manualAllowed}
                        placeholder={
                            requiredCount <= 0
                                ? 'Enter a quantity first…'
                                : manualAllowed
                                  ? 'Scan or type serial, press Enter…'
                                  : 'Auto-generated item — use Generate.'
                        }
                    />
                </div>
                {canGenerate && (
                    <button
                        type="button"
                        onClick={handleGenerate}
                        disabled={remaining <= 0 || generating}
                        title="Generate the remaining serial numbers automatically"
                        className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-emerald-200 bg-white px-2.5 py-2 font-mono text-[11px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-50 disabled:opacity-50"
                    >
                        {generating ? (
                            <Loader2 size={12} className="animate-spin" />
                        ) : (
                            <Sparkles size={12} />
                        )}
                        Generate{remaining > 0 ? ` ${remaining}` : ''}
                    </button>
                )}
                {manualAllowed && (
                    <>
                        <button
                            type="button"
                            onClick={() => fileRef.current?.click()}
                            disabled={requiredCount <= 0}
                            title="Import serials from a CSV or text file (one per line)"
                            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-2 font-mono text-[11px] text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
                        >
                            <FileUp size={12} />
                            Import
                        </button>
                        <input
                            ref={fileRef}
                            type="file"
                            accept=".csv,.txt"
                            className="hidden"
                            onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) handleImportFile(f);
                                e.target.value = '';
                            }}
                        />
                    </>
                )}
            </div>

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
                {manualAllowed
                    ? 'Tip: barcode scanners work directly — each scan adds a serial. Paste a list (one per line) or import a CSV to add in bulk.'
                    : 'Serials are generated automatically. Remove any serial and regenerate, or clear all to start over.'}
            </p>
        </div>
    );
}
