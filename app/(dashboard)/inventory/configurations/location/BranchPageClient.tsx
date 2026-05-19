'use client';

import BranchForm from '@/components/forms/inventory/configurations/BranchForm';
import { BranchProps } from '@/types/branch';
import {
    Building2,
    Edit2,
    MapPin,
    Phone,
    Plus,
    Search,
    Star,
    Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface Props {
    branches: BranchProps[];
}

export default function BranchPageClient({ branches }: Props) {
    const router = useRouter();
    const [search, setSearch] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<BranchProps | null>(null);
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

    const showToast = (msg: string, type: 'success' | 'error') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const filtered = branches.filter(
        (b) =>
            b.name.toLowerCase().includes(search.toLowerCase()) ||
            (b.code ?? '').toLowerCase().includes(search.toLowerCase()),
    );

    const onDelete = async (id: number) => {
        if (!confirm('Delete this branch? This cannot be undone.')) return;
        try {
            const res = await fetch(`/api/branch/${id}`, { method: 'DELETE' });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error ?? 'Delete failed');
            showToast('Branch deleted.', 'success');
            router.refresh();
        } catch (err: any) {
            showToast(err.message, 'error');
        }
    };

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
                <BranchForm
                    branch={editing}
                    onClose={() => {
                        setShowForm(false);
                        setEditing(null);
                    }}
                    onSuccess={() => {
                        showToast(editing ? 'Branch updated.' : 'Branch created.', 'success');
                        router.refresh();
                    }}
                />
            )}

            <div className="mx-auto space-y-8 animate-in fade-in duration-500 p-4 md:p-8">
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div>
                        <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
                            <Building2 className="text-blue-600" />
                            Branches
                        </h2>
                        <p className="mt-1 text-sm text-slate-500">
                            គ្រប់គ្រងសាខានៃអាជីវកម្ម — ហាង​ និង​​ឃ្លាំង
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="relative max-w-sm">
                            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search by name or code…"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowForm(true)}
                            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                        >
                            <Plus size={16} />
                            New Branch
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filtered.length === 0 ? (
                        <div className="col-span-full rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center">
                            <Building2 className="mx-auto h-10 w-10 text-slate-300" />
                            <p className="mt-3 text-sm text-slate-400">No branches found.</p>
                        </div>
                    ) : (
                        filtered.map((b) => (
                            <div
                                key={b.id}
                                className="group rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h3 className="truncate text-base font-semibold text-slate-800">
                                                {b.name}
                                            </h3>
                                            {b.is_default && (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                                                    <Star size={10} fill="currentColor" />
                                                    Default
                                                </span>
                                            )}
                                            {!b.is_active && (
                                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                                                    Inactive
                                                </span>
                                            )}
                                        </div>
                                        {b.code && (
                                            <span className="mt-1 inline-block rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                                                {b.code}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="mt-3 space-y-1.5 text-sm text-slate-600">
                                    {b.address && (
                                        <div className="flex items-start gap-2">
                                            <MapPin size={14} className="mt-0.5 shrink-0 text-slate-400" />
                                            <span className="line-clamp-2">{b.address}</span>
                                        </div>
                                    )}
                                    {b.phone && (
                                        <div className="flex items-center gap-2">
                                            <Phone size={14} className="shrink-0 text-slate-400" />
                                            <span>{b.phone}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                                    <Link
                                        href={`/inventory/configurations/location/${b.id}`}
                                        className="text-xs font-medium text-blue-600 hover:underline"
                                    >
                                        Manage Storage Locations →
                                    </Link>
                                    <div className="flex items-center gap-1">
                                        <button
                                            type="button"
                                            onClick={() => setEditing(b)}
                                            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
                                            aria-label="Edit"
                                        >
                                            <Edit2 size={14} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => onDelete(b.id)}
                                            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                                            aria-label="Delete"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </>
    );
}