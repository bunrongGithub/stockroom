'use client';

import { FieldLabel } from '@/components/ui/FieldLabel';
import { ReadonlyInput } from '@/components/ui/Readonly';
import { AuditInformationCard } from '@/components/ui/AuditInformationCard';
import type { AuditMeta } from '@/types/audit';
import {
    ArrowLeft,
    BarChart3,
    Building2,
    CalendarDays,
    ChevronRight,
    Clock,
    Edit2,
    Percent,
    RotateCcw,
    ScanBarcode,
    ShieldCheck,
    Tag,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

export type ServiceViewItem = {
    id: number;
    name: string;
    reference_no: string | null;
    sku: string | null;
    description: string | null;
    item_class: string;
    price: number;
    min_price: number | null;
    max_price: number | null;
    cost: number | null;
    is_variant: boolean;
    is_discount: boolean;
    is_sellable: boolean;
    is_returnable: boolean;
    is_warranty: boolean;
    warranty_duration: string | null;
    category_id: number | null;
    uom_id: number | null;
    created_at: string;
    updated_at: string;
    category: { id: number; name: string; reference_no?: string } | null;
    uom: { id: number; name: string } | null;
    company: { id: number; name: string } | null;
};

const TABS = [
    { id: 'details' as const, label: 'Details' },
    { id: 'pricing' as const, label: 'Pricing Details' },
    { id: 'options' as const, label: 'More Options' },
];
type TabId = (typeof TABS)[number]['id'];

function ReadonlyToggle({
    checked,
    icon,
    label,
    description,
}: {
    checked: boolean;
    icon: React.ReactNode;
    label: string;
    description: string;
}) {
    return (
        <div
            className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${
                checked
                    ? 'border-blue-200 bg-blue-50/60 shadow-sm'
                    : 'border-slate-100 bg-white'
            }`}
        >
            <div
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${
                    checked ? 'border-blue-500 bg-blue-500 text-white' : 'border-slate-300 bg-white'
                }`}
            >
                {checked && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path
                            d="M2.5 6L5 8.5L9.5 3.5"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>
                )}
            </div>
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <span className={checked ? 'text-blue-600' : 'text-slate-400'}>{icon}</span>
                    <span className={`text-sm font-semibold ${checked ? 'text-blue-800' : 'text-slate-700'}`}>
                        {label}
                    </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-400">{description}</p>
            </div>
        </div>
    );
}

export default function ServiceItemViewDetail({ item }: { item: ServiceViewItem }) {
    const [activeTab, setActiveTab] = useState<TabId>('details');

    const profit = (item.price ?? 0) - (item.cost ?? 0);
    const profitMargin =
        (item.price ?? 0) > 0
            ? ((profit / (item.price ?? 1)) * 100).toFixed(1)
            : '0.0';
    const createdAt = new Date(item.created_at);

    return (
        <div className="mx-auto space-y-2 font-mono">
            {/* Header */}
            <div className="font-bold">
                <Link
                    href="/inventory/configurations/service-item"
                    className="inline-flex items-center gap-2 text-sm text-slate-500 transition-colors hover:text-slate-700"
                >
                    <ArrowLeft size={16} /> Back
                </Link>
            </div>

            <div className="grid gap-6 xl:grid-cols-[350px_minmax(0,1fr)]">
                {/* LEFT SIDEBAR */}
                <aside className="space-y-4 self-start xl:sticky xl:top-6">
                    <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
                        <div className="flex items-center gap-2 border-b border-slate-50 bg-slate-50/80 px-4 py-2.5">
                            <Building2 size={13} className="text-[#1a9e52]" />
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Item Info</span>
                        </div>
                        <div className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-[#1a9e52] to-emerald-700 text-sm font-bold text-white shadow-sm">
                                    {item.name?.[0]?.toUpperCase() ?? 'S'}
                                </div>
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-slate-800">{item.name}</p>
                                    <span className="inline-flex items-center rounded-full bg-[#1a9e52]/10 px-2 py-0.5 text-[10px] font-semibold capitalize text-[#1a9e52]">
                                        {item.company?.name ?? 'N/A'}
                                    </span>
                                </div>
                            </div>
                            <div className="mt-3 space-y-1.5 rounded-xl bg-slate-50 p-3">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="flex items-center gap-1.5 text-slate-400">
                                        <Building2 size={11} /> Company
                                    </span>
                                    <span className="font-semibold text-slate-700">
                                        {item.company?.name ?? '—'}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="flex items-center gap-1.5 text-slate-400">
                                        <CalendarDays size={11} /> Created
                                    </span>
                                    <span className="font-semibold text-slate-700">
                                        {createdAt.toLocaleDateString('en-GB', {
                                            day: '2-digit',
                                            month: 'short',
                                            year: 'numeric',
                                        })}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="flex items-center gap-1.5 text-slate-400">
                                        <Clock size={11} /> Time
                                    </span>
                                    <span className="font-semibold text-slate-700">
                                        {createdAt.toLocaleTimeString('en-US', {
                                            hour: '2-digit',
                                            minute: '2-digit',
                                        })}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Action Buttons */}
                    <div className="flex flex-col-reverse gap-2">
                        <Link
                            href="/inventory/configurations/service-item"
                            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-center text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
                        >
                            Back
                        </Link>
                        <Link
                            href={`/inventory/configurations/service-item/${item.id}/update`}
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1a9e52] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#158042]"
                        >
                            <Edit2 size={15} /> Update
                        </Link>
                    </div>
                </aside>

                {/* RIGHT — Tabs + Content */}
                <div>
                    <div className="flex gap-0 border-b border-slate-200 text-xs">
                        {TABS.map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 border-b-2 px-5 py-3 transition-all ${
                                    activeTab === tab.id
                                        ? 'border-[#1a9e52] text-[#1a9e52]'
                                        : 'border-transparent text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Tab 1: Details */}
                    {activeTab === 'details' && (
                        <div className="space-y-5 pt-5 text-xs">
                            <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                                <div className="grid gap-4 lg:grid-cols-2">
                                    <div>
                                        <FieldLabel>Reference No</FieldLabel>
                                        <ReadonlyInput value={item.reference_no ?? ''} placeholder="—" />
                                    </div>
                                    <div>
                                        <FieldLabel>Service Name</FieldLabel>
                                        <ReadonlyInput value={item.name} />
                                    </div>
                                    <div>
                                        <FieldLabel>Category</FieldLabel>
                                        <ReadonlyInput value={item.category?.name ?? ''} placeholder="—" />
                                    </div>
                                    <div>
                                        <FieldLabel>Default UOM</FieldLabel>
                                        <ReadonlyInput value={item.uom?.name ?? ''} placeholder="—" />
                                    </div>
                                    <div>
                                        <FieldLabel>Barcode / SKU</FieldLabel>
                                        <div className="relative">
                                            <ReadonlyInput value={item.sku ?? ''} placeholder="—" />
                                            <ScanBarcode
                                                size={16}
                                                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-300"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <FieldLabel>Item Class</FieldLabel>
                                        <ReadonlyInput value={item.item_class} />
                                    </div>
                                </div>
                            </section>

                            <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                                <FieldLabel>Additional Notes</FieldLabel>
                                <div className="mt-1 min-h-24 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 whitespace-pre-wrap">
                                    {item.description || (
                                        <span className="text-slate-300">—</span>
                                    )}
                                </div>
                            </section>

                            <div className="flex justify-end">
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('pricing')}
                                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
                                >
                                    Pricing Details <ChevronRight size={16} />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Tab 2: Pricing Details */}
                    {activeTab === 'pricing' && (
                        <div className="space-y-5 pt-5">
                            <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                                <h3 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                                    <Tag size={13} className="text-[#1a9e52]" /> Pricing
                                </h3>
                                <div className="grid gap-4 sm:grid-cols-3">
                                    <div>
                                        <FieldLabel>Cost ($)</FieldLabel>
                                        <ReadonlyInput
                                            value={item.cost != null ? `$${Number(item.cost).toFixed(2)}` : ''}
                                            placeholder="—"
                                        />
                                    </div>
                                    <div>
                                        <FieldLabel>Sale Price ($)</FieldLabel>
                                        <ReadonlyInput value={`$${Number(item.price).toFixed(2)}`} />
                                    </div>
                                    <div>
                                        <FieldLabel>Profit</FieldLabel>
                                        <div
                                            className={`flex min-h-11.5 items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold ${
                                                profit > 0
                                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                                    : profit < 0
                                                      ? 'border-red-200 bg-red-50 text-red-600'
                                                      : 'border-slate-200 bg-slate-50 text-slate-500'
                                            }`}
                                        >
                                            <BarChart3 size={14} />${profit.toFixed(2)}{' '}
                                            <span className="text-xs font-normal opacity-70">
                                                ({profitMargin}%)
                                            </span>
                                        </div>
                                    </div>
                                    <div>
                                        <FieldLabel>Min Price ($)</FieldLabel>
                                        <ReadonlyInput
                                            value={item.min_price != null ? `$${Number(item.min_price).toFixed(2)}` : ''}
                                            placeholder="—"
                                        />
                                    </div>
                                    <div>
                                        <FieldLabel>Max Price ($)</FieldLabel>
                                        <ReadonlyInput
                                            value={item.max_price != null ? `$${Number(item.max_price).toFixed(2)}` : ''}
                                            placeholder="—"
                                        />
                                    </div>
                                </div>
                            </section>

                            <div className="flex justify-between">
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('details')}
                                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
                                >
                                    <ArrowLeft size={16} /> Details
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('options')}
                                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
                                >
                                    More Options <ChevronRight size={16} />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Tab 3: More Options */}
                    {activeTab === 'options' && (
                        <div className="space-y-5 pt-5">
                            <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                                <h3 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                                    <ShieldCheck size={13} className="text-[#1a9e52]" /> Item Properties
                                </h3>
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <ReadonlyToggle
                                        checked={item.is_warranty || !!item.warranty_duration}
                                        icon={<ShieldCheck size={16} />}
                                        label="Has Warranty"
                                        description="Item comes with a warranty"
                                    />
                                    <ReadonlyToggle
                                        checked={item.is_discount}
                                        icon={<Percent size={16} />}
                                        label="Discountable"
                                        description="Allow discounts on this item"
                                    />
                                    <ReadonlyToggle
                                        checked={item.is_returnable}
                                        icon={<RotateCcw size={16} />}
                                        label="Returnable"
                                        description="Allow customer returns"
                                    />
                                    {/* <ReadonlyToggle
                                        checked={item.is_sellable}
                                        icon={<Tag size={16} />}
                                        label="Sellable"
                                        description="Show in POS for sale"
                                    /> */}
                                </div>
                                {item.warranty_duration && (
                                    <div className="mt-4">
                                        <FieldLabel>Warranty Duration</FieldLabel>
                                        <ReadonlyInput value={item.warranty_duration} />
                                    </div>
                                )}
                            </section>

                            <div className="flex justify-start">
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('pricing')}
                                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
                                >
                                    <ArrowLeft size={16} /> Pricing Details
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <AuditInformationCard audit={item as Partial<AuditMeta>} />
        </div>
    );
}
