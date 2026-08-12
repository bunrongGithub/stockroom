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
import { stockCountApi } from '@/lib/api/stock-count';
import type {
    CompletionPreview,
    StockCount,
    UncountedPolicy,
} from '@/types/inventory/stock-count';
import { AlertTriangle, CheckCircle2, Loader2Icon } from 'lucide-react';
import { useEffect, useState } from 'react';

/**
 * The single step that closes a count.
 *
 * There is no approval gate, so choosing how to treat uncounted lines and
 * reviewing what the adjustments will move happen in one place: the policy
 * radio re-runs the dry run, and the confirm button generates and posts the
 * adjustments for real.
 */

const POLICY_OPTIONS = [
    [
        'ignore',
        'Adjust only counted lines',
        'Uncounted lines are left untouched.',
    ],
    [
        'zero',
        'Treat uncounted as zero',
        'Every uncounted line is adjusted down to zero.',
    ],
] as const;

function signed(v: number) {
    return v > 0 ? `+${v}` : String(v);
}

export default function CompletionDialog({
    count,
    pendingLines,
    open,
    onOpenChange,
    onCompleted,
}: {
    count: StockCount;
    /** Lines still uncounted, used to explain why the policy matters. */
    pendingLines: number;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCompleted: () => void;
}) {
    const toast = useToast();
    const [policy, setPolicy] = useState<UncountedPolicy>(
        count.uncounted_policy ?? 'ignore',
    );
    const [preview, setPreview] = useState<CompletionPreview | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [completing, setCompleting] = useState(false);

    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        // Deferred so the reset + fetch never set state synchronously in the
        // effect body (react-hooks/set-state-in-effect).
        const timer = setTimeout(async () => {
            setLoading(true);
            setError('');
            setPreview(null);
            try {
                const data = await stockCountApi.completePreview(
                    count.id,
                    policy,
                );
                if (!cancelled) setPreview(data);
            } catch (e) {
                if (!cancelled)
                    setError(e instanceof Error ? e.message : 'Failed to load preview');
            } finally {
                if (!cancelled) setLoading(false);
            }
        }, 0);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [open, count.id, policy]);

    async function handleComplete() {
        setCompleting(true);
        setError('');
        try {
            await stockCountApi.complete(count.id, policy);
            toast.success('Count completed — adjustments generated.');
            onOpenChange(false);
            onCompleted();
        } catch (e) {
            // The API error explains partial progress; re-running resumes at
            // the locations that have no adjustment yet.
            setError(e instanceof Error ? e.message : 'Completion failed');
        } finally {
            setCompleting(false);
        }
    }

    const locked = completing || loading;

    return (
        <Dialog open={open} onOpenChange={(o) => !completing && onOpenChange(o)}>
            <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Complete {count.count_no}</DialogTitle>
                    <DialogDescription>
                        Review the adjustments this will generate. Posting them
                        closes the count.
                    </DialogDescription>
                </DialogHeader>

                <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-1">
                    <section className="space-y-2">
                        <p className="text-xs text-muted-foreground">
                            {pendingLines > 0
                                ? `${pendingLines} line${pendingLines !== 1 ? 's are' : ' is'} still uncounted. Choose how to treat them.`
                                : 'All lines are counted.'}
                        </p>
                        <div className="space-y-2 text-sm">
                            {POLICY_OPTIONS.map(([value, label, help]) => (
                                <label
                                    key={value}
                                    className="flex min-h-11 cursor-pointer items-start gap-2.5 rounded-lg border border-border/60 px-3 py-2.5 hover:bg-muted/40"
                                >
                                    <input
                                        type="radio"
                                        name="uncounted_policy"
                                        className="mt-1"
                                        disabled={completing}
                                        checked={policy === value}
                                        onChange={() => setPolicy(value)}
                                    />
                                    <span>
                                        <span className="block font-medium">{label}</span>
                                        <span className="block text-xs text-muted-foreground">
                                            {help}
                                        </span>
                                    </span>
                                </label>
                            ))}
                        </div>
                    </section>

                    {loading && (
                        <div className="flex h-32 items-center justify-center">
                            <Loader2Icon className="animate-spin text-muted-foreground" size={22} />
                        </div>
                    )}

                    {error && (
                        <div className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger-muted px-3 py-2.5 text-xs text-danger">
                            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                            <p>{error}</p>
                        </div>
                    )}

                    {preview && (
                        <>
                            <div className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5 text-xs">
                                <p className="font-medium text-foreground">
                                    {preview.total_adjustment_lines} adjustment line
                                    {preview.total_adjustment_lines !== 1 ? 's' : ''} across{' '}
                                    {preview.locations.length} location
                                    {preview.locations.length !== 1 ? 's' : ''}
                                </p>
                                <p className="mt-0.5 text-muted-foreground">
                                    Uncounted policy:{' '}
                                    {preview.uncounted_policy === 'zero'
                                        ? 'uncounted lines are treated as zero'
                                        : 'uncounted lines are ignored'}
                                    {preview.uncounted_lines > 0 &&
                                        ` (${preview.uncounted_lines} uncounted line${preview.uncounted_lines !== 1 ? 's' : ''})`}
                                </p>
                                {!preview.has_variance && (
                                    <p className="mt-1 flex items-center gap-1.5 text-success">
                                        <CheckCircle2 size={14} />
                                        No variance — the session will complete without generating
                                        adjustments.
                                    </p>
                                )}
                            </div>

                            {preview.locations.map((loc) => (
                                <section key={loc.location_id} className="space-y-1.5">
                                    <h4 className="flex items-center gap-2 text-xs font-semibold text-foreground">
                                        Location {loc.location_name ?? `#${loc.location_id}`}
                                        {loc.already_generated && (
                                            <span className="rounded-full bg-success-muted px-2 py-0.5 text-[10px] font-medium text-success">
                                                already generated ✓
                                            </span>
                                        )}
                                    </h4>
                                    <div className="overflow-x-auto rounded-lg border border-border/60">
                                        <table className="w-full text-xs tnums">
                                            <thead>
                                                <tr className="border-b border-border/60 bg-muted/40 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                                                    <th className="px-2.5 py-2 font-semibold">SKU</th>
                                                    <th className="px-2.5 py-2 font-semibold">Item</th>
                                                    <th className="px-2.5 py-2 text-right font-semibold">Counted</th>
                                                    <th className="px-2.5 py-2 text-right font-semibold">Live</th>
                                                    <th className="px-2.5 py-2 text-right font-semibold">Adjustment</th>
                                                    <th className="px-2.5 py-2 font-semibold" />
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {loc.lines.map((line) => (
                                                    <tr
                                                        key={line.line_id}
                                                        className="border-b border-border/40 last:border-b-0"
                                                    >
                                                        <td className="px-2.5 py-1.5">{line.sku ?? '—'}</td>
                                                        <td className="px-2.5 py-1.5">{line.item_name ?? '—'}</td>
                                                        <td className="px-2.5 py-1.5 text-right">{line.counted_qty}</td>
                                                        <td className="px-2.5 py-1.5 text-right">{line.live_qty}</td>
                                                        <td
                                                            className={`px-2.5 py-1.5 text-right font-semibold ${
                                                                line.adjustment_qty > 0
                                                                    ? 'text-success'
                                                                    : line.adjustment_qty < 0
                                                                      ? 'text-danger'
                                                                      : 'text-muted-foreground'
                                                            }`}
                                                        >
                                                            {signed(line.adjustment_qty)}
                                                        </td>
                                                        <td className="px-2.5 py-1.5">
                                                            {line.drift && (
                                                                <span
                                                                    title={`Stock moved during the count: snapshot ${line.snapshot_qty}, live ${line.live_qty}`}
                                                                    className="inline-flex items-center gap-1 rounded-full bg-warning-muted px-2 py-0.5 text-[10px] font-medium text-warning-foreground"
                                                                >
                                                                    <AlertTriangle size={10} /> moved during count
                                                                </span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </section>
                            ))}

                            {(preview.dropped_serials.length > 0 ||
                                preview.foreign_serials.length > 0) && (
                                <div className="space-y-2 rounded-xl border border-warning/40 bg-warning-muted px-3 py-2.5 text-xs text-warning-foreground">
                                    {preview.dropped_serials.length > 0 && (
                                        <div>
                                            <p className="font-semibold">
                                                Dropped serials (no longer available, excluded)
                                            </p>
                                            <p className="mt-0.5 font-mono">
                                                {preview.dropped_serials
                                                    .map((s) => s.serial_number)
                                                    .join(', ')}
                                            </p>
                                        </div>
                                    )}
                                    {preview.foreign_serials.length > 0 && (
                                        <div>
                                            <p className="font-semibold">
                                                Foreign serials (exist elsewhere, excluded — investigate)
                                            </p>
                                            <p className="mt-0.5 font-mono">
                                                {preview.foreign_serials
                                                    .map((s) => s.serial_number)
                                                    .join(', ')}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" disabled={completing} onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button disabled={locked || !preview} onClick={handleComplete}>
                        {completing && <Loader2Icon size={15} className="animate-spin" />}
                        Complete &amp; Generate Adjustments
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
