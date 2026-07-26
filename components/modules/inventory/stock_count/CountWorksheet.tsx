'use client';

import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/Toast';
import { useTableQuery } from '@/hook/useTableQuery';
import { API } from '@/lib/constant';
import { stockCountApi, type CountLineEntry } from '@/lib/api/stock-count';
import type {
    StockCount,
    StockCountItem,
    StockCountSummary,
} from '@/types/inventory/stock-count';
import { CheckIcon, Loader2Icon, ScanBarcode, ScanLine } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import SerialCountPanel from './SerialCountPanel';

const SAVE_DEBOUNCE_MS = 600;
const SAVE_CHUNK = 50;

function varianceClass(v: number | null) {
    if (v == null || v === 0) return 'text-muted-foreground';
    return v > 0 ? 'text-success' : 'text-danger';
}

function signed(v: number) {
    return v > 0 ? `+${v}` : String(v);
}

export default function CountWorksheet({
    count,
    summary,
    canCount,
    onChanged,
}: {
    count: StockCount;
    summary?: StockCountSummary | null;
    canCount: boolean;
    onChanged?: () => void;
}) {
    const toast = useToast();
    const table = useTableQuery<StockCountItem>({
        endpoint: API.inventory.stockCount.lines(count.id),
        syncToUrl: false,
        defaultLimit: 20,
    });

    // Dirty edits overlay the server rows until the debounced batch save lands.
    // The ref mirrors the state so async flushes and scan increments read the
    // latest values; both are only written through `applyDirty`.
    const [dirty, setDirtyState] = useState<Record<number, string>>({});
    const dirtyRef = useRef<Record<number, string>>({});
    const applyDirty = useCallback(
        (updater: (prev: Record<number, string>) => Record<number, string>) => {
            dirtyRef.current = updater(dirtyRef.current);
            setDirtyState(dirtyRef.current);
        },
        [],
    );
    const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [saving, setSaving] = useState(false);
    const [savedFlash, setSavedFlash] = useState(false);

    const [serialLine, setSerialLine] = useState<StockCountItem | null>(null);
    const [scanValue, setScanValue] = useState('');
    const [scanBusy, setScanBusy] = useState(false);
    const [matchChoices, setMatchChoices] = useState<StockCountItem[]>([]);
    const scanRef = useRef<HTMLInputElement>(null);

    const refreshRef = useRef(table.refresh);
    useEffect(() => {
        refreshRef.current = table.refresh;
    }, [table.refresh]);

    const flushDirty = useCallback(async () => {
        const snapshot = { ...dirtyRef.current };
        const entries: CountLineEntry[] = Object.entries(snapshot)
            .map(([id, v]) => ({
                line_id: Number(id),
                counted_qty: v === '' ? null : Number(v),
            }))
            .filter((e) => e.counted_qty === null || !Number.isNaN(e.counted_qty));
        if (entries.length === 0) return;

        setSaving(true);
        try {
            for (let i = 0; i < entries.length; i += SAVE_CHUNK) {
                await stockCountApi.recordCounts(count.id, entries.slice(i, i + SAVE_CHUNK));
            }
            // Only clear entries the operator has not re-edited mid-flight.
            applyDirty((prev) => {
                const next = { ...prev };
                for (const key of Object.keys(snapshot)) {
                    const id = Number(key);
                    if (next[id] === snapshot[id]) delete next[id];
                }
                return next;
            });
            await refreshRef.current();
            onChanged?.();
            setSavedFlash(true);
            setTimeout(() => setSavedFlash(false), 1500);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Failed to save counts');
        } finally {
            setSaving(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [count.id, applyDirty]);

    const scheduleFlush = useCallback(() => {
        if (flushTimer.current) clearTimeout(flushTimer.current);
        flushTimer.current = setTimeout(() => flushDirty(), SAVE_DEBOUNCE_MS);
    }, [flushDirty]);

    useEffect(() => {
        return () => {
            if (flushTimer.current) clearTimeout(flushTimer.current);
        };
    }, []);

    function setLineValue(lineId: number, value: string) {
        applyDirty((prev) => ({ ...prev, [lineId]: value }));
        scheduleFlush();
    }

    /** One more of a non-serial line (scan path). */
    function incrementLine(line: StockCountItem) {
        const raw = dirtyRef.current[line.id];
        const current = raw !== undefined && raw !== '' ? Number(raw) : (line.counted_qty ?? 0);
        const next = (Number.isNaN(current) ? 0 : current) + 1;
        setLineValue(line.id, String(next));
        toast.success(`${line.sku ?? line.item_name ?? 'Item'} → ${next}`);
    }

    function handleMatched(line: StockCountItem) {
        setMatchChoices([]);
        if (line.is_serial) setSerialLine(line);
        else incrementLine(line);
        setScanValue('');
        scanRef.current?.focus();
    }

    async function handleScan() {
        const code = scanValue.trim();
        if (!code || scanBusy) return;
        setScanBusy(true);
        try {
            const matches = await stockCountApi.scan(count.id, code);
            if (matches.length === 0) {
                toast.error('Not in count scope');
                setScanValue('');
                scanRef.current?.focus();
            } else if (matches.length === 1) {
                handleMatched(matches[0]);
            } else {
                // Same item in several locations — the operator picks the line.
                setMatchChoices(matches);
            }
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Scan failed');
        } finally {
            setScanBusy(false);
        }
    }

    function focusNextInput(current: HTMLInputElement) {
        const inputs = Array.from(
            document.querySelectorAll<HTMLInputElement>('input[data-line-input]'),
        );
        const next = inputs[inputs.indexOf(current) + 1];
        next?.focus();
        next?.select();
    }

    const statusFilter = table.state.filters['status'] ?? '';

    const columns: DataTableColumn<StockCountItem>[] = [
        {
            key: 'sku',
            header: 'SKU',
            primary: true,
            sortable: true,
            cell: (row) => <span className="font-medium">{row.sku ?? '—'}</span>,
        },
        { key: 'item_name', header: 'Item Name', sortable: true, cell: (row) => row.item_name },
        { key: 'location_name', header: 'Location', cell: (row) => row.location_name ?? '—' },
        { key: 'uom', header: 'UOM', cell: (row) => row.uom ?? '—' },
        {
            key: 'snapshot_qty',
            header: 'Snapshot Qty',
            align: 'right',
            sortable: true,
            cell: (row) => <span className="tnums">{row.snapshot_qty}</span>,
        },
        {
            key: 'counted_qty',
            header: 'Counted',
            align: 'right',
            cardFooter: true,
            cell: (row) => {
                if (row.is_serial) {
                    const label = `Scan · ${row.serial_scanned ?? 0}/${row.serial_expected ?? 0}`;
                    return canCount ? (
                        <Button variant="outline" size="sm" onClick={() => setSerialLine(row)}>
                            <ScanBarcode size={14} /> {label}
                        </Button>
                    ) : (
                        <span className="tnums">{row.counted_qty ?? '—'}</span>
                    );
                }
                if (!canCount) return <span className="tnums">{row.counted_qty ?? '—'}</span>;
                return (
                    <input
                        data-line-input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        value={dirty[row.id] ?? (row.counted_qty != null ? String(row.counted_qty) : '')}
                        placeholder="—"
                        onChange={(e) => setLineValue(row.id, e.target.value)}
                        onBlur={() => flushDirty()}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                focusNextInput(e.currentTarget);
                            }
                        }}
                        className="h-9 w-24 rounded-md border border-input bg-background px-2 text-right text-sm tnums outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
                    />
                );
            },
        },
        {
            key: 'variance_qty',
            header: 'Variance',
            align: 'right',
            sortable: true,
            cell: (row) => {
                const raw = dirty[row.id];
                const v =
                    raw !== undefined && raw !== '' && !Number.isNaN(Number(raw))
                        ? Number(raw) - row.snapshot_qty
                        : row.variance_qty;
                if (v == null) return <span className="text-muted-foreground">—</span>;
                return <span className={`font-medium tnums ${varianceClass(v)}`}>{signed(v)}</span>;
            },
        },
        {
            key: 'status',
            header: 'Status',
            cell: (row) => (
                <StatusBadge
                    status={row.status}
                    tone={row.status === 'COUNTED' ? 'success' : 'neutral'}
                />
            ),
        },
    ];

    const pct = summary?.progress_pct ?? 0;

    return (
        <div className="space-y-3">
            {canCount && (
                <div className="sticky top-0 z-20 bg-background pb-1">
                    <div className="relative">
                        <ScanLine
                            size={16}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-success"
                        />
                        <input
                            ref={scanRef}
                            value={scanValue}
                            onChange={(e) => setScanValue(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleScan();
                                }
                                if (e.key === 'Escape') {
                                    setScanValue('');
                                    setMatchChoices([]);
                                }
                            }}
                            placeholder="Scan barcode or serial, press Enter…"
                            aria-label="Scan item or serial"
                            autoComplete="off"
                            className="w-full rounded-xl border border-border bg-card py-3 pl-10 pr-10 text-sm shadow-sm transition focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                        />
                        {scanBusy && (
                            <Loader2Icon
                                size={16}
                                className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground"
                            />
                        )}
                        {matchChoices.length > 0 && (
                            <ul className="absolute z-30 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-border bg-card shadow-lg">
                                {matchChoices.map((m) => (
                                    <li key={m.id}>
                                        <button
                                            type="button"
                                            onClick={() => handleMatched(m)}
                                            className="flex min-h-10 w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted/50"
                                        >
                                            <span className="truncate">
                                                {m.sku ?? ''} {m.item_name ?? ''}
                                            </span>
                                            <span className="ml-3 shrink-0 text-xs text-muted-foreground">
                                                {m.location_name ?? '—'}
                                            </span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            )}

            {/* Status filter pills */}
            <div className="flex items-center gap-1.5">
                {(
                    [
                        ['', 'All'],
                        ['PENDING', 'Pending'],
                        ['COUNTED', 'Counted'],
                    ] as const
                ).map(([value, label]) => (
                    <Button
                        key={label}
                        variant={statusFilter === value ? 'default' : 'outline'}
                        size="sm"
                        className="rounded-full"
                        onClick={() => table.binding.onFilter('status', value || null)}
                    >
                        {label}
                    </Button>
                ))}
            </div>

            <DataTable<StockCountItem>
                columns={columns}
                data={table.data}
                keyExtractor={(row) => row.id}
                mobileVariant="cards"
                minTableWidth="820px"
                searchPlaceholder="Search by SKU or item name..."
                pageSizeOptions={[10, 20, 50]}
                serverQuery={table.binding}
                emptyTitle="No count lines"
                emptyDescription={
                    count.status === 'DRAFT'
                        ? 'Prepare the count to freeze the snapshot and generate lines.'
                        : 'No lines match the current filter.'
                }
            />

            {/* Sticky progress footer */}
            <div className="sticky bottom-0 z-10 flex items-center gap-3 border-t border-border/60 bg-background py-2 text-xs text-muted-foreground">
                <span className="shrink-0 tnums">
                    Counted {summary?.counted_lines ?? 0} / {summary?.total_lines ?? 0}
                    {summary ? ` — ${Math.round(pct)}%` : ''}
                </span>
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                        className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-success' : 'bg-warning'}`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                </div>
                <span className="flex shrink-0 items-center gap-1">
                    {saving ? (
                        <>
                            <Loader2Icon size={12} className="animate-spin" /> Saving…
                        </>
                    ) : savedFlash ? (
                        <>
                            <CheckIcon size={12} className="text-success" /> Saved
                        </>
                    ) : Object.keys(dirty).length > 0 ? (
                        'Unsaved changes'
                    ) : null}
                </span>
            </div>

            {serialLine && (
                <SerialCountPanel
                    countId={count.id}
                    line={serialLine}
                    open={serialLine !== null}
                    onOpenChange={(o) => {
                        if (!o) {
                            setSerialLine(null);
                            refreshRef.current();
                            onChanged?.();
                            scanRef.current?.focus();
                        }
                    }}
                    onChanged={onChanged}
                />
            )}
        </div>
    );
}
