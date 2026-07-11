'use client';

import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LoadingState } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/button';
import { useRegisterModule } from '@/hook/useModule';
import type { ModuleProps } from '@/lib/registry';
import { uomApi, type UomDetail } from '@/lib/api/uom';
import { ArrowLeft, Edit2, FileWarning, Package, Star } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

function Field({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground">{label}</p>
            <div className="text-sm text-foreground">{value || '—'}</div>
        </div>
    );
}

export default function InventoryUomView({
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
    const id = Number(
        Array.isArray(params.slug) ? params.slug.at(-2) : params.slug,
    );

    const [detail, setDetail] = useState<UomDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!id) return;
        (async () => {
            try {
                setDetail(await uomApi.get(id));
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Failed to load unit');
            } finally {
                setLoading(false);
            }
        })();
    }, [id]);

    if (loading) return <LoadingState />;
    if (error || !detail) {
        return (
            <div className="flex h-64 flex-col items-center justify-center gap-3">
                <FileWarning className="text-muted-foreground" size={40} />
                <p className="text-sm text-muted-foreground">
                    {error || 'Unit not found.'}
                </p>
                <button
                    onClick={() => router.push('/inventory/configurations/uom')}
                    className="text-xs text-primary hover:underline"
                >
                    Back to Units of Measure
                </button>
            </div>
        );
    }

    const { data: uom, usage, items } = detail;
    const fmtDate = (d?: string | null) =>
        d
            ? new Date(d).toLocaleString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
              })
            : '—';

    return (
        <div className="mx-auto max-w-3xl space-y-4">
            <button
                type="button"
                onClick={() => router.push('/inventory/configurations/uom')}
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
                <ArrowLeft size={16} /> Back to Units of Measure
            </button>

            <PageHeader
                title={
                    <span className="inline-flex items-center gap-2">
                        {uom.code}
                        {uom.is_default && (
                            <Star className="size-4 fill-warning text-warning" />
                        )}
                    </span>
                }
                description={uom.name}
                actions={
                    permission.can_update && (
                        <Button
                            onClick={() =>
                                router.push(
                                    `/inventory/configurations/uom/${uom.id}/update`,
                                )
                            }
                        >
                            <Edit2 size={15} /> Edit
                        </Button>
                    )
                }
            />

            {/* General information */}
            <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
                <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    General Information
                </h3>
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
                    <Field label="Code" value={<span className="font-medium">{uom.code}</span>} />
                    <Field label="Name" value={uom.name} />
                    <Field label="Symbol" value={<span className="font-mono">{uom.display_name}</span>} />
                    <Field
                        label="Status"
                        value={<StatusBadge status={uom.is_active ? 'ACTIVE' : 'INACTIVE'} />}
                    />
                    <Field
                        label="Default"
                        value={uom.is_default ? 'Yes — company default' : 'No'}
                    />
                    <Field label="Description" value={uom.description} />
                </div>
            </section>

            {/* Usage */}
            <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
                <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Usage
                </h3>
                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <p className="text-2xl font-bold tabular-nums">{usage.item_count}</p>
                        <p className="text-xs text-muted-foreground">Items</p>
                    </div>
                    <div>
                        <p className="text-2xl font-bold tabular-nums">{usage.item_uom_count}</p>
                        <p className="text-xs text-muted-foreground">Item-UOM setups</p>
                    </div>
                    <div>
                        <p className="text-2xl font-bold tabular-nums">{usage.movement_count}</p>
                        <p className="text-xs text-muted-foreground">Movement lines</p>
                    </div>
                </div>
                {usage.in_use && (
                    <p className="mt-4 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                        This unit is referenced by transactions and cannot be
                        deleted. Deactivate it to stop new usage.
                    </p>
                )}
            </section>

            {/* Items using this UOM */}
            <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
                <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Items Using This Unit ({usage.item_count})
                </h3>
                {items.length === 0 ? (
                    <EmptyState
                        icon={Package}
                        compact
                        title="No items use this unit yet"
                    />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border/60 text-left text-xs text-muted-foreground">
                                    <th className="py-2 pr-3 font-medium">Item</th>
                                    <th className="py-2 font-medium">SKU</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((it) => (
                                    <tr
                                        key={it.id}
                                        className="border-b border-border/40 last:border-0"
                                    >
                                        <td className="py-2 pr-3">{it.name}</td>
                                        <td className="py-2 font-mono text-xs text-muted-foreground">
                                            {it.sku || '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {/* Audit */}
            <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
                <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Record
                </h3>
                <div className="grid grid-cols-2 gap-4">
                    <Field label="Created" value={fmtDate(uom.created_at)} />
                    <Field label="Last Updated" value={fmtDate(uom.updated_at)} />
                </div>
            </section>
        </div>
    );
}
