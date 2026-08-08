'use client';

import { useRegisterModule } from '@/hook/useModule';
import type { ModuleProps } from '@/lib/registry';
import { uomApi, type UomDetail } from '@/lib/api/uom';
import {
    ArrowLeft,
    Edit2,
    Loader2,
    Package,
    Ruler,
    Star,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

const LIST_URL = '/inventory/configurations/uom';

function Field({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div>
            <p className="text-slate-400">{label}</p>
            <div className="mt-0.5 text-slate-800">{value || '—'}</div>
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
    const id = Number(
        Array.isArray(params.slug) ? params.slug.at(-2) : params.slug,
    );

    const [detail, setDetail] = useState<UomDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!id) return;
        setLoading(true);
        uomApi
            .get(id)
            .then(setDetail)
            .catch((e) =>
                setError(e instanceof Error ? e.message : 'Failed to load unit'),
            )
            .finally(() => setLoading(false));
    }, [id]);

    if (loading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loader2 className="animate-spin text-[#1a9e52]" size={28} />
            </div>
        );
    }

    if (error || !detail) {
        return (
            <div className="flex h-64 items-center justify-center font-mono text-xs text-red-500">
                {error || 'Unit not found'}
            </div>
        );
    }

    const { data: uom, usage, items } = detail;

    return (
        <div className="space-y-4 font-mono text-xs">
            <div>
                <Link
                    href={LIST_URL}
                    className="inline-flex items-center gap-2 text-slate-500 transition-colors hover:text-slate-700"
                >
                    <ArrowLeft size={16} /> Back
                </Link>
                <div className="mt-3 flex flex-col justify-between gap-4 md:flex-row md:items-center">
                    <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-800 md:text-3xl">
                        <Ruler className="text-[#1a9e52]" />
                        {uom.code}
                        {uom.is_default && (
                            <Star
                                size={16}
                                className="fill-amber-400 text-amber-400"
                            />
                        )}
                    </h2>
                    {permission.can_update && (
                        <Link
                            href={`${LIST_URL}/${uom.id}/update`}
                            className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 font-semibold text-white transition-colors hover:bg-emerald-700"
                        >
                            <Edit2 size={15} /> Edit Unit
                        </Link>
                    )}
                </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[350px_minmax(0,1fr)]">
                {/* Sidebar — usage summary */}
                <aside className="space-y-4 self-start xl:sticky xl:top-6">
                    <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
                        <div className="flex items-center gap-2 border-b border-slate-50 bg-slate-50/80 px-4 py-2.5">
                            <Package size={13} className="text-[#1a9e52]" />
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                Usage
                            </span>
                        </div>
                        <div className="space-y-2 p-4">
                            <div className="flex items-center justify-between">
                                <span className="text-slate-400">Items</span>
                                <span className="font-semibold text-slate-800">
                                    {usage.item_count}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-slate-400">
                                    Item-UOM setups
                                </span>
                                <span className="font-semibold text-slate-800">
                                    {usage.item_uom_count}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-slate-400">
                                    Movement lines
                                </span>
                                <span className="font-semibold text-slate-800">
                                    {usage.movement_count}
                                </span>
                            </div>
                            {usage.in_use && (
                                <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-slate-500">
                                    In use — cannot be deleted. Set it inactive
                                    instead.
                                </p>
                            )}
                        </div>
                    </section>
                </aside>

                {/* Main */}
                <div className="space-y-4">
                    <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                        <h3 className="mb-4 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                            <Ruler size={13} className="text-[#1a9e52]" /> Unit
                            Information
                        </h3>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            <Field label="Code" value={uom.code} />
                            <Field label="Name" value={uom.name} />
                            <Field label="Symbol" value={uom.display_name} />
                            <Field
                                label="Status"
                                value={
                                    <span
                                        className={`inline-flex items-center rounded-md px-2 py-1 text-[10px] ${
                                            uom.is_active
                                                ? 'bg-emerald-50 text-emerald-600'
                                                : 'bg-slate-100 text-slate-500'
                                        }`}
                                    >
                                        {uom.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                }
                            />
                            <Field
                                label="Default"
                                value={uom.is_default ? 'Yes' : 'No'}
                            />
                            <Field label="Description" value={uom.description} />
                        </div>
                    </section>

                    <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                        <h3 className="mb-4 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                            <Package size={13} className="text-[#1a9e52] " /> Items
                            Using This Unit ({usage.item_count})
                        </h3>
                        {items.length === 0 ? (
                            <p className="py-6 text-center text-slate-400">
                                No items use this unit yet.
                            </p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-slate-100 text-left text-slate-400">
                                            <th className="py-2 pr-3 font-medium">
                                                Item
                                            </th>
                                            <th className="py-2 font-medium">
                                                SKU
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((it) => (
                                            <tr
                                                key={it.id}
                                                className="border-b border-slate-50 last:border-0"
                                            >
                                                <td className="py-2 pr-3 text-slate-800">
                                                    {it.name}
                                                </td>
                                                <td className="py-2 text-slate-500">
                                                    {it.sku || '—'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </div>
    );
}
