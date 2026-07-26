'use client';

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/Toast';
import SerialScannerInput from '@/components/ui/serial/SerialScannerInput';
import { stockCountApi } from '@/lib/api/stock-count';
import type {
    SerialClassification,
    StockCountItem,
    StockCountSerial,
} from '@/types/inventory/stock-count';
import { Loader2Icon, X } from 'lucide-react';
import { useEffect, useState } from 'react';

// Classification chips: matched = confirmed on hand, new = found but not in
// the snapshot, foreign = belongs elsewhere (excluded from adjustment),
// missing/expected = not yet found.
const CHIP: Record<SerialClassification | 'expected', { label: string; className: string }> = {
    matched: { label: 'Matched', className: 'bg-success-muted text-success' },
    new: { label: '+ New', className: 'bg-info-muted text-info' },
    foreign: { label: 'Foreign — investigate', className: 'bg-warning-muted text-warning-foreground' },
    missing: { label: 'Missing', className: 'bg-danger-muted text-danger' },
    expected: { label: 'Expected', className: 'bg-muted text-muted-foreground' },
};

export default function SerialCountPanel({
    countId,
    line,
    open,
    onOpenChange,
    onChanged,
}: {
    countId: number;
    line: StockCountItem;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onChanged?: () => void;
}) {
    const toast = useToast();
    // null = not loaded yet; the worksheet mounts this panel per line, so the
    // list starts fresh each time it opens.
    const [serialsState, setSerials] = useState<StockCountSerial[] | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        stockCountApi
            .listSerials(countId, line.id)
            .then((data) => {
                if (!cancelled) setSerials(data);
            })
            .catch((e) => {
                toast.error(e instanceof Error ? e.message : 'Failed to load serials');
                if (!cancelled) setSerials([]);
            });
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, countId, line.id]);

    const loading = serialsState === null;
    const serials = serialsState ?? [];
    const scanned = serials.filter((s) => s.is_scanned).length;
    const expected = serials.filter((s) => s.is_expected).length || (line.serial_expected ?? 0);
    const pct = expected > 0 ? Math.min((scanned / expected) * 100, 100) : 0;

    const counts = serials.reduce<Record<string, number>>((acc, s) => {
        const key = s.is_scanned ? (s.classification ?? 'matched') : 'expected';
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
    }, {});

    async function handleScan(entered: string[]) {
        setBusy(true);
        try {
            const res = await stockCountApi.recordSerials(countId, line.id, entered);
            setSerials(res.serials);
            for (const r of res.rejected) toast.error(`${r.serial_number}: ${r.reason}`);
            onChanged?.();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Failed to record serials');
        } finally {
            setBusy(false);
        }
    }

    async function handleRemove(serialNumber: string) {
        setBusy(true);
        try {
            const res = await stockCountApi.removeSerial(countId, line.id, serialNumber);
            setSerials(res.serials);
            onChanged?.();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Failed to remove serial');
        } finally {
            setBusy(false);
        }
    }

    function chipFor(s: StockCountSerial) {
        if (!s.is_scanned) return CHIP.expected;
        return CHIP[s.classification ?? 'matched'];
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="font-mono">
                        {line.sku ?? ''} {line.item_name ?? ''}
                    </DialogTitle>
                    <DialogDescription>
                        Scanned {scanned} of {expected} expected
                    </DialogDescription>
                </DialogHeader>

                <SerialScannerInput onCommit={handleScan} disabled={busy} />

                <div className="flex items-center gap-3">
                    <span className="font-mono text-[11px] font-semibold tnums text-muted-foreground">
                        {scanned} / {expected}
                    </span>
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                            className={`h-full rounded-full transition-all ${scanned >= expected && expected > 0 ? 'bg-success' : 'bg-warning'}`}
                            style={{ width: `${pct}%` }}
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="flex h-24 items-center justify-center">
                        <Loader2Icon className="animate-spin text-muted-foreground" size={20} />
                    </div>
                ) : (
                    <div className="max-h-80 space-y-1 overflow-y-auto rounded-lg border border-border/60 p-2">
                        {serials.length === 0 && (
                            <p className="py-6 text-center text-xs text-muted-foreground">
                                No serials yet — scan the first one.
                            </p>
                        )}
                        {serials.map((s) => {
                            const chip = chipFor(s);
                            return (
                                <div
                                    key={s.id}
                                    className="flex min-h-9 items-center justify-between gap-2 rounded-md px-2 py-1 hover:bg-muted/40"
                                >
                                    <span className="truncate font-mono text-xs text-foreground">
                                        {s.serial_number}
                                    </span>
                                    <span className="flex shrink-0 items-center gap-1.5">
                                        <span
                                            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${chip.className}`}
                                        >
                                            {chip.label}
                                        </span>
                                        {s.is_scanned && (
                                            <button
                                                type="button"
                                                disabled={busy}
                                                onClick={() => handleRemove(s.serial_number)}
                                                aria-label={`Remove ${s.serial_number}`}
                                                className="rounded p-1 text-muted-foreground hover:text-danger disabled:opacity-50"
                                            >
                                                <X size={12} />
                                            </button>
                                        )}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}

                <DialogFooter className="flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-[11px] text-muted-foreground">
                        {(['matched', 'new', 'foreign', 'missing', 'expected'] as const)
                            .filter((k) => counts[k])
                            .map((k) => `${CHIP[k].label}: ${counts[k]}`)
                            .join(' · ') || '—'}
                    </p>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
