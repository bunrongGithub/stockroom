'use client';

import StockLocationForm from '@/components/forms/inventory/configurations/StockLocationForm';
import { BranchProps, StockLocationProps } from '@/types/branch';
import { ArrowLeft, Edit2, MapPin, Plus, Star, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface Props {
    branch: BranchProps;
}

export default function BranchDetailClient({ branch }: Props) {
    const router = useRouter();
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<StockLocationProps | null>(null);
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

    const showToast = (msg: string, type: 'success' | 'error') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const onDelete = async (id: number) => {
        if (!confirm('Delete this storage location?')) return;
        try {
            const res = await fetch(`/api/stock-location/${id}`, { method: 'DELETE' });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error ?? 'Delete failed');
            showToast('Location deleted.', 'success');
            router.refresh();
        } catch (err: any) {
            showToast(err.message, 'error');
        }
    };

    const locations = branch.stock_location ?? [];

    return (
        <>
            {toast && (
                <div
                    className={`fixed right-4 top-4 z-[60] rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${
                        toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
                    }`}
                >
                    {toast.msg}
                </div>
            )}

            {(showForm || editing) && (
                <StockLocationForm
                    branchId={branch.id}
                    location={editing}
                    onClose={() => {
                        setShowForm(false);
                        setEditing(null);
                    }}
                    onSuccess={() => {
                        showToast(editing ? 'Location updated.' : 'Location created.', 'success');
                        router.refresh();
                    }}
                />
            )}

            <div className="mx-auto space-y-8 animate-in fade-in duration-500 p-4 md:p-8">
                <Link
                    href="/inventory/configurations/location"
                    className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
                >
                    <ArrowLeft size={14} /> Back to Branches
                </Link>

                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div>
                        <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
                            {branch.name}
                            {branch.is_default && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
                                    <Star size={12} fill="currentColor" /> Default
                                </span>
                            )}
                        </h2>
                        <p className="mt-1 text-sm text-slate-500">
                            {branch.address ?? 'No address set'} · {branch.phone ?? 'No phone'}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowForm(true)}
                        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
                    >
                        <Plus size={16} /> New Storage Location
                    </button>
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
                    <div className="border-b border-slate-100 bg-slate-50 px-6 py-3">
                        <h3 className="text-sm font-semibold text-slate-700">
                            Storage Locations ({locations.length})
                        </h3>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {locations.length === 0 ? (
                            <div className="py-16 text-center">
                                <MapPin className="mx-auto h-10 w-10 text-slate-300" />
                                <p className="mt-3 text-sm text-slate-400">
                                    No storage locations yet. Add one to start placing inventory here.
                                </p>
                            </div>
                        ) : (
                            locations.map((loc) => (
                                <div key={loc.id} className="flex items-center justify-between px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                                            <MapPin size={16} />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-semibold text-slate-800">
                                                    {loc.name}
                                                </span>
                                                {loc.is_default && (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                                                        <Star size={10} fill="currentColor" />
                                                        Default
                                                    </span>
                                                )}
                                            </div>
                                            {loc.code && (
                                                <span className="text-xs text-slate-500">{loc.code}</span>
                                            )}
                                            {loc.description && (
                                                <p className="mt-0.5 text-xs text-slate-500">{loc.description}</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button
                                            type="button"
                                            onClick={() => setEditing(loc)}
                                            className="rounded-lg p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600"
                                        >
                                            <Edit2 size={14} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => onDelete(loc.id)}
                                            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}