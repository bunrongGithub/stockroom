'use client';

import { useRegisterModule } from '@/hook/useModule';
import type { ModuleProps } from '@/lib/registry';
import { useTableQuery } from '@/hook/useTableQuery';
import { stockCountApi } from '@/lib/api/stock-count';
import { API } from '@/lib/constant';
import { formatDate, formatDateTime } from '@/lib/utils/date';
import type {
    CompletionPreview,
    StockCount,
    StockCountItem,
    StockCountSummary,
    UncountedPolicy,
} from '@/types/inventory/stock-count';
import type { AuditMeta } from '@/types/audit';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { AuditInformationCard } from '@/components/ui/AuditInformationCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/Toast';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import KpiCard from '@/components/modules/dashboard/widgets/KpiCard';
import CountWorksheet from '../CountWorksheet';
import CompletionDialog from '../CompletionDialog';
import {
    AlertTriangle,
    ArrowLeftIcon,
    Ban,
    CheckCircle2,
    ClipboardCheck,
    ClipboardList,
    Clock3,
    FileWarning,
    Link2,
    Loader2Icon,
    PencilIcon,
    PlayIcon,
    RotateCcwIcon,
    SendIcon,
    Sigma,
    SnowflakeIcon,
    Trash2Icon,
    TrendingDown,
    TrendingUp,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

function signed(v: number) {
    return v > 0 ? `+${v}` : String(v);
}

function money(n: number) {
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const MODE_LABEL: Record<StockCount['count_mode'], string> = {
    full: 'Full Warehouse',
    location: 'Single Location',
    category: 'By Category',
    items: 'Specific Items',
};

// Registered as `InventoryStockCountDetail`.
export default function InventoryStockCountDetail({
    currentPath,
    permission,
    currentPathActions,
}: ModuleProps) {
    useRegisterModule({
        actionModules: currentPathActions,
        permission,
        modulePath: currentPath.path,
    });

    const params = useParams();
    const router = useRouter();
    const toast = useToast();
    const id = Number(Array.isArray(params.slug) ? params.slug.at(-2) : '');

    const [count, setCount] = useState<StockCount | null>(null);
    const [summary, setSummary] = useState<StockCountSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    const [confirmPrepare, setConfirmPrepare] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [cancelOpen, setCancelOpen] = useState(false);
    const [cancelReason, setCancelReason] = useState('');
    const [completeOpen, setCompleteOpen] = useState(false);

    async function load() {
        try {
            const [c, s] = await Promise.all([
                stockCountApi.get(id),
                stockCountApi.summary(id).catch(() => null),
            ]);
            setCount(c);
            setSummary(s);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load stock count');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (!id) return;
        // Deferred so state is never set synchronously inside the effect body.
        const timer = setTimeout(() => {
            void load();
        }, 0);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    function reloadSummary() {
        stockCountApi.summary(id).then(setSummary).catch(() => {});
    }

    /** Lifecycle action wrapper — toasts, reloads, returns success. */
    async function run(action: () => Promise<unknown>, successMessage?: string) {
        setBusy(true);
        try {
            await action();
            if (successMessage) toast.success(successMessage);
            await load();
            router.refresh();
            return true;
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Action failed');
            return false;
        } finally {
            setBusy(false);
        }
    }

    if (loading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loader2Icon className="animate-spin text-success" size={26} />
            </div>
        );
    }

    if (error || !count) {
        return (
            <div className="flex h-64 flex-col items-center justify-center gap-3">
                <FileWarning className="text-muted-foreground" size={40} />
                <p className="text-sm text-muted-foreground">{error || 'Stock count not found.'}</p>
                <button
                    onClick={() => router.push('/inventory/stock_count')}
                    className="text-xs text-info hover:underline"
                >
                    Back to list
                </button>
            </div>
        );
    }

    const a = count.actions;
    const canWork = Boolean(permission?.can_update);
    const viewPath = `/inventory/stock_count/${count.id}/view`;
    const canCount = Boolean(a?.can_count && canWork);
    const shortTone = (summary?.qty_short ?? 0) > 0 ? 'danger' : 'default';
    const pendingTone = (summary?.pending_lines ?? 0) > 0 ? 'warning' : 'default';

    return (
        <div className="space-y-4 font-mono">
            <PageHeader
                title={
                    <span className="inline-flex items-center gap-3">
                        {count.count_no}
                        <StatusBadge status={count.status} />
                    </span>
                }
                description={`${count.warehouse_name} · ${count.location_name ?? 'All locations'} · ${formatDate(count.count_date)}`}
                actions={
                    <>
                        {canWork && a?.can_prepare && (
                            <Button disabled={busy} onClick={() => setConfirmPrepare(true)}>
                                <SnowflakeIcon size={15} /> Prepare
                            </Button>
                        )}
                        {canWork && a?.can_start && (
                            <Button
                                disabled={busy}
                                onClick={() => run(() => stockCountApi.start(count.id), 'Counting started.')}
                            >
                                <PlayIcon size={15} /> Start Counting
                            </Button>
                        )}
                        {canWork && a?.can_complete && (
                            <Button disabled={busy} onClick={() => setCompleteOpen(true)}>
                                <CheckCircle2 size={15} /> Complete Count
                            </Button>
                        )}
                        {canWork && a?.can_update && (
                            <Button
                                variant="outline"
                                onClick={() => router.push(`/inventory/stock_count/${count.id}/update`)}
                            >
                                <PencilIcon size={15} /> Edit
                            </Button>
                        )}
                        {canWork && a?.can_cancel && (
                            <Button
                                variant="outline"
                                className="text-danger hover:text-danger"
                                disabled={busy}
                                onClick={() => setCancelOpen(true)}
                            >
                                <Ban size={15} /> Cancel
                            </Button>
                        )}
                        {permission?.can_delete && a?.can_delete && (
                            <Button
                                variant="outline"
                                className="text-danger hover:text-danger"
                                disabled={busy}
                                onClick={() => setConfirmDelete(true)}
                            >
                                <Trash2Icon size={15} /> Delete
                            </Button>
                        )}
                        <Button variant="outline" onClick={() => router.push('/inventory/stock_count')}>
                            <ArrowLeftIcon size={15} /> Back
                        </Button>
                    </>
                }
            />

            <Tabs defaultValue="overview" className="w-full flex-col">
                <TabsList className="grid w-full max-w-md grid-cols-3">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="worksheet">Worksheet</TabsTrigger>
                    <TabsTrigger value="variance">Variance</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="w-full space-y-4 pt-3">
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                        <KpiCard label="Total Items" value={String(summary?.total_lines ?? 0)} href={viewPath} icon={ClipboardList} />
                        <KpiCard label="Counted" value={String(summary?.counted_lines ?? 0)} href={viewPath} icon={ClipboardCheck} />
                        <KpiCard label="Pending" value={String(summary?.pending_lines ?? 0)} href={viewPath} icon={Clock3} tone={pendingTone} />
                        <KpiCard label="Over (+)" value={String(summary?.qty_over ?? 0)} href={viewPath} icon={TrendingUp} />
                        <KpiCard label="Short (−)" value={String(summary?.qty_short ?? 0)} href={viewPath} icon={TrendingDown} tone={shortTone} />
                        <KpiCard label="Variance Value" value={money(summary?.variance_value ?? 0)} href={viewPath} icon={Sigma} />
                    </div>

                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="shrink-0 tnums">
                            Counted {summary?.counted_lines ?? 0} / {summary?.total_lines ?? 0} —{' '}
                            {Math.round(summary?.progress_pct ?? 0)}%
                        </span>
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                            <div
                                className={`h-full rounded-full transition-all ${(summary?.progress_pct ?? 0) >= 100 ? 'bg-success' : 'bg-warning'}`}
                                style={{ width: `${Math.min(summary?.progress_pct ?? 0, 100)}%` }}
                            />
                        </div>
                    </div>

                    <section className="rounded-2xl border border-border/60 bg-card p-5 text-xs shadow-sm">
                        <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            Count Information
                        </h3>
                        <div className="grid grid-cols-2 gap-y-3 lg:grid-cols-4">
                            <span className="text-muted-foreground">Warehouse</span>
                            <span className="font-medium">{count.warehouse_name}</span>
                            <span className="text-muted-foreground">Location</span>
                            <span className="font-medium">{count.location_name ?? 'All locations'}</span>
                            <span className="text-muted-foreground">Mode</span>
                            <span>{MODE_LABEL[count.count_mode]}</span>
                            <span className="text-muted-foreground">Count Date</span>
                            <span className="tnums">{formatDate(count.count_date)}</span>
                            <span className="text-muted-foreground">Snapshot Frozen</span>
                            <span className="tnums">{formatDateTime(count.snapshot_at)}</span>
                            <span className="text-muted-foreground">Uncounted Policy</span>
                            <span>{count.uncounted_policy === 'zero' ? 'Treat uncounted as zero' : 'Adjust only counted lines'}</span>
                            <span className="text-muted-foreground">Remarks</span>
                            <span>{count.remarks || '—'}</span>
                            {count.status === 'CANCELLED' && (
                                <>
                                    <span className="text-muted-foreground">Cancel Reason</span>
                                    <span>{count.cancel_reason || '—'}</span>
                                </>
                            )}
                        </div>
                    </section>

                    <section className="rounded-2xl border border-border/60 bg-card p-5 text-xs shadow-sm">
                        <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            Generated Adjustments
                        </h3>
                        {count.adjustments.length === 0 ? (
                            <p className="text-muted-foreground">
                                No adjustments generated yet — they appear here once the count is completed.
                            </p>
                        ) : (
                            <ul className="space-y-2">
                                {count.adjustments.map((adj) => (
                                    <li key={adj.adjustment_id} className="flex flex-wrap items-center gap-2">
                                        <Link2 size={13} className="text-muted-foreground" />
                                        <Link
                                            href={`/inventory/stock_adjust/${adj.adjustment_id}/view`}
                                            className="font-medium text-primary hover:underline"
                                        >
                                            {adj.adjustment_no}
                                        </Link>
                                        <span className="text-muted-foreground">{adj.location_name}</span>
                                        <StatusBadge status={adj.status} />
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>

                    <AuditInformationCard audit={count as Partial<AuditMeta>} />
                </TabsContent>

                <TabsContent value="worksheet" className="w-full pt-3">
                    <CountWorksheet
                        count={count}
                        summary={summary}
                        canCount={canCount}
                        onChanged={reloadSummary}
                    />
                </TabsContent>

                <TabsContent value="variance" className="w-full pt-3">
                    <VarianceTab count={count} />
                </TabsContent>
            </Tabs>

            <ConfirmDialog
                open={confirmPrepare}
                onOpenChange={setConfirmPrepare}
                title="Prepare Count"
                description={`Freeze the stock snapshot for ${count.count_no}? Count lines are generated from the current on-hand balances; later stock movements will not change the snapshot.`}
                confirmLabel="Freeze Snapshot"
                onConfirm={async () => {
                    setBusy(true);
                    try {
                        const res = await stockCountApi.prepare(count.id);
                        toast.success(`Snapshot frozen: ${res.line_count} lines`);
                        await load();
                        router.refresh();
                    } catch (e) {
                        toast.error(e instanceof Error ? e.message : 'Prepare failed');
                        throw e;
                    } finally {
                        setBusy(false);
                    }
                }}
            />

            <ConfirmDialog
                open={confirmDelete}
                onOpenChange={setConfirmDelete}
                title="Delete Stock Count"
                description={`Delete ${count.count_no}? This cannot be undone.`}
                confirmLabel="Delete"
                tone="danger"
                onConfirm={async () => {
                    try {
                        await stockCountApi.remove(count.id);
                        toast.success('Stock count deleted.');
                        router.push('/inventory/stock_count');
                        router.refresh();
                    } catch (e) {
                        toast.error(e instanceof Error ? e.message : 'Cannot delete stock count');
                        throw e;
                    }
                }}
            />

            {/* Cancel dialog — danger, with an optional reason */}
            <Dialog open={cancelOpen} onOpenChange={(o) => !busy && setCancelOpen(o)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <AlertTriangle size={16} className="text-danger" /> Cancel Count
                        </DialogTitle>
                        <DialogDescription>
                            Cancel {count.count_no}? All recorded counts are kept for reference but the
                            session is closed without generating adjustments.
                        </DialogDescription>
                    </DialogHeader>
                    <Input
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        placeholder="Reason (optional)"
                        className="text-xs font-mono"
                    />
                    <DialogFooter>
                        <Button variant="outline" disabled={busy} onClick={() => setCancelOpen(false)}>
                            Back
                        </Button>
                        <Button
                            variant="destructive"
                            disabled={busy}
                            onClick={async () => {
                                const ok = await run(
                                    () => stockCountApi.cancel(count.id, cancelReason.trim() || null),
                                    'Count cancelled.',
                                );
                                if (ok) setCancelOpen(false);
                            }}
                        >
                            {busy && <Loader2Icon size={15} className="animate-spin" />}
                            Cancel Count
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <CompletionDialog
                count={count}
                pendingLines={summary?.pending_lines ?? 0}
                open={completeOpen}
                onOpenChange={setCompleteOpen}
                onCompleted={() => {
                    load();
                    router.refresh();
                }}
            />
        </div>
    );
}

// ── Variance tab ────────────────────────────────────────────────────────────
// A read-only view over the same lines endpoint, defaulting to positive
// variances. While COUNTING the completion preview overlays drift badges and
// serial warnings so the counter sees them before opening the dialog.

const VARIANCE_PILLS = [
    ['gt:0', 'Positive'],
    ['lt:0', 'Negative'],
    ['eq:0', 'Zero'],
    ['', 'All'],
] as const;

function VarianceTab({ count }: { count: StockCount }) {
    const table = useTableQuery<StockCountItem>({
        endpoint: API.inventory.stockCount.lines(count.id),
        syncToUrl: false,
        defaultLimit: 20,
    });
    const [previewState, setPreview] = useState<CompletionPreview | null>(null);
    const seeded = useRef(false);

    // Default the tab to positive variances (deferred: filter changes set
    // table state, which must not happen synchronously inside the effect).
    const onFilter = table.binding.onFilter;
    useEffect(() => {
        if (seeded.current) return;
        seeded.current = true;
        const timer = setTimeout(() => onFilter('variance_qty', 'gt:0'), 0);
        return () => clearTimeout(timer);
    }, [onFilter]);

    useEffect(() => {
        if (count.status !== 'COUNTING') return;
        let cancelled = false;
        stockCountApi
            .completePreview(count.id)
            .then((data) => {
                if (!cancelled) setPreview(data);
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, [count.id, count.status]);

    // Drift/serial warnings only apply while the count is still open — once it
    // is completed the adjustments have already settled them.
    const preview = count.status === 'COUNTING' ? previewState : null;
    const driftIds = new Set(
        preview?.locations.flatMap((loc) => loc.lines.filter((l) => l.drift).map((l) => l.line_id)) ?? [],
    );

    const active = table.state.filters['variance_qty'] ?? '';

    const columns: DataTableColumn<StockCountItem>[] = [
        {
            key: 'sku',
            header: 'SKU',
            primary: true,
            sortable: true,
            cell: (row) => <span className="font-medium">{row.sku ?? '—'}</span>,
        },
        { key: 'item_name', header: 'Item', sortable: true, cell: (row) => row.item_name },
        { key: 'location_name', header: 'Location', cell: (row) => row.location_name ?? '—' },
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
            cell: (row) => <span className="tnums">{row.counted_qty ?? '—'}</span>,
        },
        {
            key: 'variance_qty',
            header: 'Variance',
            align: 'right',
            sortable: true,
            cell: (row) => {
                const v = row.variance_qty;
                return (
                    <span className="inline-flex items-center gap-1.5">
                        {driftIds.has(row.id) && (
                            <span
                                title="Stock moved during the count — the adjustment targets the live quantity"
                                className="rounded-full bg-warning-muted px-1.5 py-0.5 text-[10px] font-medium text-warning-foreground"
                            >
                                drift
                            </span>
                        )}
                        <span
                            className={`font-medium tnums ${
                                v == null || v === 0
                                    ? 'text-muted-foreground'
                                    : v > 0
                                      ? 'text-success'
                                      : 'text-danger'
                            }`}
                        >
                            {v == null ? '—' : signed(v)}
                        </span>
                    </span>
                );
            },
        },
        {
            key: 'variance_value',
            header: 'Variance Value',
            align: 'right',
            cell: (row) => {
                if (row.variance_qty == null || row.unit_cost == null)
                    return <span className="text-muted-foreground">—</span>;
                const value = row.variance_qty * row.unit_cost;
                return (
                    <span
                        className={`tnums ${
                            value === 0 ? 'text-muted-foreground' : value > 0 ? 'text-success' : 'text-danger'
                        }`}
                    >
                        {money(value)}
                    </span>
                );
            },
        },
    ];

    return (
        <div className="space-y-3">
            {preview && (preview.dropped_serials.length > 0 || preview.foreign_serials.length > 0) && (
                <div className="space-y-1 rounded-xl border border-warning/40 bg-warning-muted px-3 py-2.5 text-xs text-warning-foreground">
                    {preview.dropped_serials.length > 0 && (
                        <p>
                            <span className="font-semibold">{preview.dropped_serials.length} dropped serial(s)</span>{' '}
                            no longer available — excluded from the adjustment.
                        </p>
                    )}
                    {preview.foreign_serials.length > 0 && (
                        <p>
                            <span className="font-semibold">{preview.foreign_serials.length} foreign serial(s)</span>{' '}
                            exist elsewhere — excluded, investigate before completing.
                        </p>
                    )}
                </div>
            )}

            <div className="flex items-center gap-1.5">
                {VARIANCE_PILLS.map(([value, label]) => (
                    <Button
                        key={label}
                        variant={active === value ? 'default' : 'outline'}
                        size="sm"
                        className="rounded-full"
                        onClick={() => onFilter('variance_qty', value || null)}
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
                emptyTitle="No variance lines"
                emptyDescription="No lines match the current variance filter."
            />
        </div>
    );
}
