'use client';

import { FieldLabel } from '@/components/ui/FieldLabel';
import { ReadonlyInput } from '@/components/ui/Readonly';
import { useRegisterModule } from '@/hook/useModule';
import type { ModuleProps } from '@/lib/registry';
import type { InventoryUom } from '@/service/apps/inventory/repo/uom';
import {
    ArrowLeft,
    Building2,
    CalendarDays,
    Clock,
    Edit2,
    Loader2,
    Ruler,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

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
    const id = Number(
        Array.isArray(params.slug) ? params.slug.at(-2) : params.slug,
    );

    const [item, setItem] = useState<InventoryUom | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!id) return;
        setLoading(true);
        fetch(`/api/inventory/configurations/uom/${id}`)
            .then((r) => r.json())
            .then((json) => {
                if (json.data) setItem(json.data);
                else setError(json.error ?? 'UOM not found');
            })
            .catch(() => setError('Failed to load UOM'))
            .finally(() => setLoading(false));
    }, [id]);

    if (loading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loader2 className="animate-spin text-emerald-500" size={28} />
            </div>
        );
    }

    if (error || !item) {
        return (
            <div className="flex h-64 items-center justify-center text-sm text-red-500">
                {error || 'UOM not found'}
            </div>
        );
    }

    const createdAt = new Date(item.created_at);

    return (
        <div className="mx-auto max-w-2xl space-y-6 p-4 md:p-8">
            <div>
                <Link
                    href="/inventory/configurations/uom"
                    className="inline-flex items-center gap-2 text-sm text-slate-500 transition-colors hover:text-slate-700"
                >
                    <ArrowLeft size={16} /> Back to Units of Measure
                </Link>
                <h2 className="mt-3 flex items-center gap-2 text-2xl font-bold text-slate-800">
                    <Ruler className="text-emerald-500" /> Unit of Measure Detail
                </h2>
            </div>

            <div className="grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)]">
                {/* Sidebar */}
                <aside className="space-y-4 self-start xl:sticky xl:top-6">
                    <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
                        <div className="flex items-center gap-2 border-b border-slate-50 bg-slate-50/80 px-4 py-2.5">
                            <Building2 size={13} className="text-emerald-500" />
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">UOM Info</span>
                        </div>
                        <div className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-emerald-500 to-emerald-700 text-sm font-bold text-white shadow-sm">
                                    {item.display_name?.[0]?.toUpperCase() ?? 'U'}
                                </div>
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-slate-800">{item.name}</p>
                                    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                                        {item.display_name}
                                    </span>
                                </div>
                            </div>
                            <div className="mt-3 space-y-1.5 rounded-xl bg-slate-50 p-3">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="flex items-center gap-1.5 text-slate-400"><CalendarDays size={11} /> Created</span>
                                    <span className="font-semibold text-slate-700">
                                        {createdAt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="flex items-center gap-1.5 text-slate-400"><Clock size={11} /> Time</span>
                                    <span className="font-semibold text-slate-700">
                                        {createdAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </section>

                    <div className="flex flex-col-reverse gap-2">
                        <Link
                            href="/inventory/configurations/uom"
                            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-center text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
                        >
                            Back
                        </Link>
                        {permission.can_update && (
                            <Link
                                href={`/inventory/configurations/uom/${item.id}/edit`}
                                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
                            >
                                <Edit2 size={15} /> Edit UOM
                            </Link>
                        )}
                    </div>
                </aside>

                {/* Detail card */}
                <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                    <h3 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                        <Ruler size={13} className="text-emerald-500" /> UOM Information
                    </h3>
                    <div className="space-y-4">
                        <div>
                            <FieldLabel>Full Name</FieldLabel>
                            <ReadonlyInput value={item.name} />
                        </div>
                        <div>
                            <FieldLabel>Abbreviation</FieldLabel>
                            <ReadonlyInput value={item.display_name} />
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}
