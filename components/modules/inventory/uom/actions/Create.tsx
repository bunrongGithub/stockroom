'use client';

import {
    EditableInput,
    FieldLabel,
} from '@/components/ui/FieldLabel';
import { useRegisterModule } from '@/hook/useModule';
import type { ModuleProps } from '@/lib/registry';
import {
    AlertCircle,
    ArrowLeft,
    Building2,
    CalendarDays,
    Clock,
    Loader2,
    Ruler,
    User,
    X,
} from 'lucide-react';
import { useUserProfile } from '@/context/UserProfileContext';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

type FormValues = {
    name: string;
    display_name: string;
};

export default function InventoryUomCreate({
    currentPath,
    permission,
    currentPathActions,
}: ModuleProps) {
    useRegisterModule({
        actionModules: currentPathActions,
        permission,
        modulePath: currentPath.path,
    });

    const router = useRouter();
    const currentUser = useUserProfile();
    const [submitError, setSubmitError] = useState('');
    const [createdAt] = useState(() => new Date());

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<FormValues>({ defaultValues: { name: '', display_name: '' } });

    const onSubmit = async (data: FormValues) => {
        setSubmitError('');
        try {
            const res = await fetch('/api/inventory/configurations/uom', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });

            if (!res.ok) {
                const json = await res.json().catch(() => ({}));
                throw new Error(json.error?.message ?? json.error ?? 'Failed to create UOM');
            }

            const json = await res.json();
            router.push(`/inventory/configurations/uom/${json.data.id}/view`);
            router.refresh();
        } catch (err) {
            setSubmitError(err instanceof Error ? err.message : 'Failed to save');
        }
    };

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
                    <Ruler className="text-emerald-500" /> New Unit of Measure
                </h2>
            </div>

            {submitError && (
                <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                    <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-500" />
                    <p className="text-sm text-red-700">{submitError}</p>
                    <button type="button" onClick={() => setSubmitError('')} className="ml-auto shrink-0 text-red-400 hover:text-red-600">
                        <X size={16} />
                    </button>
                </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)]">
                {/* Sidebar */}
                <aside className="space-y-4 self-start xl:sticky xl:top-6">
                    <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
                        <div className="flex items-center gap-2 border-b border-slate-50 bg-slate-50/80 px-4 py-2.5">
                            <User size={13} className="text-emerald-500" />
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Created By</span>
                        </div>
                        <div className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-emerald-500 to-emerald-700 text-sm font-bold text-white shadow-sm">
                                    {currentUser?.email?.[0]?.toUpperCase() ?? '?'}
                                </div>
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-slate-800">{currentUser?.email ?? 'Loading...'}</p>
                                    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold capitalize text-emerald-600">
                                        {currentUser?.role ?? 'user'}
                                    </span>
                                </div>
                            </div>
                            <div className="mt-3 space-y-1.5 rounded-xl bg-slate-50 p-3">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="flex items-center gap-1.5 text-slate-400"><Building2 size={11} /> Company</span>
                                    <span className="font-semibold text-slate-700">#{currentUser?.companyId ?? '—'}</span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="flex items-center gap-1.5 text-slate-400"><CalendarDays size={11} /> Date</span>
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
                            Cancel
                        </Link>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                        >
                            {isSubmitting && <Loader2 className="animate-spin" size={16} />}
                            {isSubmitting ? 'Saving...' : 'Save UOM'}
                        </button>
                    </div>
                </aside>

                {/* Main form */}
                <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                    <h3 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                        <Ruler size={13} className="text-emerald-500" /> UOM Information
                    </h3>
                    <div className="space-y-4">
                        <div>
                            <FieldLabel required>Full Name</FieldLabel>
                            <EditableInput
                                type="text"
                                placeholder="e.g. Kilogram, Piece, Liter"
                                {...register('name', { required: 'Full name is required' })}
                            />
                            {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
                            <p className="mt-1 text-xs text-slate-400">The complete name of the unit.</p>
                        </div>
                        <div>
                            <FieldLabel required>Abbreviation</FieldLabel>
                            <EditableInput
                                type="text"
                                placeholder="e.g. kg, pcs, L"
                                maxLength={20}
                                {...register('display_name', { required: 'Abbreviation is required' })}
                            />
                            {errors.display_name && <p className="mt-1 text-xs text-red-500">{errors.display_name.message}</p>}
                            <p className="mt-1 text-xs text-slate-400">Short code shown on documents (max 20 characters).</p>
                        </div>
                    </div>
                </section>
            </form>
        </div>
    );
}
