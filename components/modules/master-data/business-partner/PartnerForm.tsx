'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PartnerRoleBadge } from '@/components/ui/PartnerRoleBadge';
import { businessPartnerApi, type PartnerWarning } from '@/lib/api/business-partner';
import type { BusinessPartner } from '@/types/master-data/business-partner';
import {
    AlertCircle,
    ArrowLeftIcon,
    Contact,
    Loader2Icon,
    SaveIcon,
    X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const TABS = [
    { id: 'general' as const, label: 'General', num: 1 },
    { id: 'business' as const, label: 'Business', num: 2 },
    { id: 'financial' as const, label: 'Financial', num: 3 },
    { id: 'address' as const, label: 'Address', num: 4 },
    { id: 'notes' as const, label: 'Notes', num: 5 },
];
type TabId = (typeof TABS)[number]['id'];

const ALL_ROLES = ['customer', 'supplier', 'carrier', 'employee', 'vendor'] as const;

export type PartnerDraft = {
    name: string;
    company_name: string;
    partner_kind: 'organization' | 'individual';
    phone: string;
    phone_alt: string;
    email: string;
    website: string;
    tax_number: string;
    vat_number: string;
    registration_number: string;
    credit_limit: string;
    payment_term_days: string;
    currency: string;
    notes: string;
    is_active: boolean;
    roles: string[];
    // Primary address — create mode only; edit manages addresses on the profile.
    country: string;
    province: string;
    district: string;
    commune: string;
    street: string;
    postal_code: string;
};

export function emptyDraft(): PartnerDraft {
    return {
        name: '',
        company_name: '',
        partner_kind: 'organization',
        phone: '',
        phone_alt: '',
        email: '',
        website: '',
        tax_number: '',
        vat_number: '',
        registration_number: '',
        credit_limit: '',
        payment_term_days: '',
        currency: 'USD',
        notes: '',
        is_active: true,
        roles: ['customer'],
        country: '',
        province: '',
        district: '',
        commune: '',
        street: '',
        postal_code: '',
    };
}

export function draftFromPartner(p: BusinessPartner): PartnerDraft {
    return {
        ...emptyDraft(),
        name: p.name ?? '',
        company_name: p.company_name ?? '',
        partner_kind: p.partner_kind ?? 'organization',
        phone: p.phone ?? '',
        phone_alt: p.phone_alt ?? '',
        email: p.email ?? '',
        website: p.website ?? '',
        tax_number: p.tax_number ?? '',
        vat_number: p.vat_number ?? '',
        registration_number: p.registration_number ?? '',
        credit_limit: p.credit_limit != null ? String(p.credit_limit) : '',
        payment_term_days:
            p.payment_term_days != null ? String(p.payment_term_days) : '',
        currency: p.currency ?? 'USD',
        notes: p.notes ?? '',
        is_active: p.is_active ?? true,
        roles: p.roles?.length ? [...p.roles] : ['customer'],
    };
}

/**
 * The Business Partner create/edit form. Tabs keep a wide master record
 * approachable; the save button lives outside them so it works from any tab.
 */
export default function PartnerForm({
    mode,
    partner,
    initial,
}: {
    mode: 'create' | 'edit';
    partner?: BusinessPartner;
    initial: PartnerDraft;
}) {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<TabId>('general');
    const [draft, setDraft] = useState<PartnerDraft>(initial);
    const [error, setError] = useState('');
    const [warnings, setWarnings] = useState<PartnerWarning[]>([]);
    const [saving, setSaving] = useState(false);

    const set = <K extends keyof PartnerDraft>(key: K, value: PartnerDraft[K]) =>
        setDraft((d) => ({ ...d, [key]: value }));

    const toggleRole = (role: string) =>
        setDraft((d) => ({
            ...d,
            roles: d.roles.includes(role)
                ? d.roles.filter((r) => r !== role)
                : [...d.roles, role],
        }));

    async function handleSubmit() {
        setError('');
        if (!draft.name.trim()) {
            setActiveTab('general');
            return setError('Partner name is required');
        }
        if (draft.roles.length === 0) {
            setActiveTab('general');
            return setError('Select at least one role — a partner with no role has no purpose');
        }

        setSaving(true);
        try {
            const payload: Record<string, unknown> = {
                name: draft.name.trim(),
                company_name: draft.company_name.trim() || null,
                partner_kind: draft.partner_kind,
                phone: draft.phone.trim() || null,
                phone_alt: draft.phone_alt.trim() || null,
                email: draft.email.trim() || null,
                website: draft.website.trim() || null,
                tax_number: draft.tax_number.trim() || null,
                vat_number: draft.vat_number.trim() || null,
                registration_number: draft.registration_number.trim() || null,
                credit_limit: draft.credit_limit === '' ? null : Number(draft.credit_limit),
                payment_term_days:
                    draft.payment_term_days === '' ? null : Number(draft.payment_term_days),
                currency: draft.currency || 'USD',
                notes: draft.notes.trim() || null,
                is_active: draft.is_active,
                roles: draft.roles,
            };

            if (mode === 'create') {
                const hasAddress =
                    draft.street || draft.province || draft.country || draft.postal_code;
                if (hasAddress) {
                    payload.address = {
                        address_type: 'both',
                        label: 'Primary',
                        country: draft.country.trim() || null,
                        province: draft.province.trim() || null,
                        district: draft.district.trim() || null,
                        commune: draft.commune.trim() || null,
                        street: draft.street.trim() || null,
                        postal_code: draft.postal_code.trim() || null,
                    };
                }
                const { partner: created, warnings: warn } =
                    await businessPartnerApi.create(payload);
                // A shared phone is legitimate (a family, a switchboard), so it
                // is reported after the save rather than blocking it.
                if (warn.length) {
                    setWarnings(warn);
                    setSaving(false);
                    setTimeout(() => {
                        router.push(`/master-data/business-partner/${created.id}/view`);
                        router.refresh();
                    }, 2500);
                    return;
                }
                router.push(`/master-data/business-partner/${created.id}/view`);
            } else {
                await businessPartnerApi.update(partner!.id, payload);
                router.push(`/master-data/business-partner/${partner!.id}/view`);
            }
            router.refresh();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to save partner');
            setSaving(false);
        }
    }

    const backHref =
        mode === 'edit' && partner
            ? `/master-data/business-partner/${partner.id}/view`
            : '/master-data/business-partner';

    return (
        <div className="space-y-4 font-mono text-xs">
            <div>
                <button
                    onClick={() => router.push(backHref)}
                    className="inline-flex items-center gap-2 text-slate-500 transition-colors hover:text-slate-700"
                >
                    <ArrowLeftIcon size={16} />{' '}
                    {mode === 'edit' ? 'Back ' : 'Back'}
                </button>
                <h2 className="mt-3 flex items-center gap-2 text-2xl font-bold text-slate-800 md:text-3xl">
                    <Contact className="text-[#1a9e52]" />
                    {mode === 'create' ? 'New Business Partner' : 'Edit Business Partner'}
                </h2>
                {mode === 'edit' && partner && (
                    <p className="mt-1 text-slate-500">
                        {partner.code} — the code never changes
                    </p>
                )}
            </div>

            {error && (
                <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                    <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-500" />
                    <p className="text-red-700">{error}</p>
                    <button
                        type="button"
                        onClick={() => setError('')}
                        className="ml-auto shrink-0 text-red-400 hover:text-red-600"
                    >
                        <X size={16} />
                    </button>
                </div>
            )}

            {warnings.map((w) => (
                <div
                    key={w.code}
                    className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3"
                >
                    <AlertCircle size={18} className="mt-0.5 shrink-0 text-amber-500" />
                    <p className="text-amber-800">
                        Saved. {w.message}{' '}
                        {w.partners.map((p) => `${p.code} ${p.name}`).join(', ')}
                    </p>
                </div>
            ))}

            <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
                {/* LEFT — summary + actions */}
                <aside className="space-y-4 self-start xl:sticky xl:top-6">
                    <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
                        <div className="border-b border-slate-50 bg-slate-50/80 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                            Partner Summary
                        </div>
                        <div className="space-y-2 p-4">
                            <div className="flex items-center justify-between">
                                <span className="text-slate-400">Code</span>
                                <span className="font-semibold text-slate-700">
                                    {partner?.code ?? 'Auto-generated'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-slate-400">Name</span>
                                <span className="truncate font-semibold text-slate-700">
                                    {draft.name || '—'}
                                </span>
                            </div>
                            <div className="flex items-start justify-between gap-2">
                                <span className="shrink-0 text-slate-400">Roles</span>
                                <span className="flex flex-wrap justify-end gap-1">
                                    {draft.roles.length ? (
                                        draft.roles.map((r) => (
                                            <PartnerRoleBadge key={r} role={r} iconOnly />
                                        ))
                                    ) : (
                                        <span className="text-slate-300">none</span>
                                    )}
                                </span>
                            </div>
                        </div>
                    </section>

                    <div className="flex flex-col gap-2">
                        <button
                            onClick={handleSubmit}
                            disabled={saving}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1a9e52] px-4 py-2.5 font-semibold text-white transition-colors hover:bg-[#158042] disabled:opacity-50"
                        >
                            {saving ? (
                                <Loader2Icon size={14} className="animate-spin" />
                            ) : (
                                <SaveIcon size={14} />
                            )}
                            {saving ? 'Saving…' : 'Save Partner'}
                        </button>
                        <button
                            onClick={() => router.push(backHref)}
                            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-center text-slate-600 transition-colors hover:bg-slate-50"
                        >
                            Cancel
                        </button>
                    </div>
                </aside>

                {/* RIGHT — tabs */}
                <div className="min-w-0">
                    <div className="flex gap-0 overflow-x-auto border-b border-slate-200">
                        {TABS.map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex shrink-0 items-center gap-2 border-b-2 px-5 py-3 transition-all ${
                                    activeTab === tab.id
                                        ? 'border-[#1a9e52] text-[#1a9e52]'
                                        : 'border-transparent text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                <span
                                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold transition-all ${
                                        activeTab === tab.id
                                            ? 'bg-[#1a9e52] text-white'
                                            : 'bg-slate-100 text-slate-500'
                                    }`}
                                >
                                    {tab.num}
                                </span>
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {activeTab === 'general' && (
                        <div className="space-y-5 pt-5">
                            <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                                <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                                    Identity
                                </h3>
                                <div className="grid gap-4 lg:grid-cols-2">
                                    <Field label="Partner Name *">
                                        <Input
                                            value={draft.name}
                                            onChange={(e) => set('name', e.target.value)}
                                            placeholder="e.g. ABC Trading"
                                            className="text-xs font-mono"
                                        />
                                    </Field>
                                    <Field label="Company Name">
                                        <Input
                                            value={draft.company_name}
                                            onChange={(e) => set('company_name', e.target.value)}
                                            placeholder="Registered legal name"
                                            className="text-xs font-mono"
                                        />
                                    </Field>
                                    <Field label="Type">
                                        <div className="flex gap-2">
                                            {(['organization', 'individual'] as const).map((k) => (
                                                <button
                                                    key={k}
                                                    type="button"
                                                    onClick={() => set('partner_kind', k)}
                                                    className={`flex-1 rounded-xl border px-3 py-2.5 capitalize transition-colors ${
                                                        draft.partner_kind === k
                                                            ? 'border-[#1a9e52] bg-emerald-50 text-[#1a9e52]'
                                                            : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                                                    }`}
                                                >
                                                    {k}
                                                </button>
                                            ))}
                                        </div>
                                    </Field>
                                    <Field label="Status">
                                        <button
                                            type="button"
                                            onClick={() => set('is_active', !draft.is_active)}
                                            className={`w-full rounded-xl border px-3 py-2.5 transition-colors ${
                                                draft.is_active
                                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                                    : 'border-slate-200 bg-slate-50 text-slate-500'
                                            }`}
                                        >
                                            {draft.is_active ? 'Active' : 'Inactive'}
                                        </button>
                                    </Field>
                                </div>
                            </section>

                            <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                                <h3 className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-500">
                                    Roles *
                                </h3>
                                <p className="mb-4 text-slate-400">
                                    A partner can be several things at once — one record,
                                    many relationships.
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {ALL_ROLES.map((role) => {
                                        const on = draft.roles.includes(role);
                                        return (
                                            <button
                                                key={role}
                                                type="button"
                                                onClick={() => toggleRole(role)}
                                                className={`rounded-xl border px-3 py-2 capitalize transition-colors ${
                                                    on
                                                        ? 'border-[#1a9e52] bg-emerald-50 text-[#1a9e52]'
                                                        : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                                                }`}
                                            >
                                                {role.replace('_', ' ')}
                                            </button>
                                        );
                                    })}
                                </div>
                            </section>

                            <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                                <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                                    Contact
                                </h3>
                                <div className="grid gap-4 lg:grid-cols-2">
                                    <Field label="Phone">
                                        <Input
                                            value={draft.phone}
                                            onChange={(e) => set('phone', e.target.value)}
                                            placeholder="e.g. 012 345 678"
                                            className="text-xs font-mono"
                                        />
                                    </Field>
                                    <Field label="Alternative Phone">
                                        <Input
                                            value={draft.phone_alt}
                                            onChange={(e) => set('phone_alt', e.target.value)}
                                            className="text-xs font-mono"
                                        />
                                    </Field>
                                    <Field label="Email">
                                        <Input
                                            type="email"
                                            value={draft.email}
                                            onChange={(e) => set('email', e.target.value)}
                                            className="text-xs font-mono"
                                        />
                                    </Field>
                                    <Field label="Website">
                                        <Input
                                            value={draft.website}
                                            onChange={(e) => set('website', e.target.value)}
                                            placeholder="https://"
                                            className="text-xs font-mono"
                                        />
                                    </Field>
                                </div>
                            </section>
                        </div>
                    )}

                    {activeTab === 'business' && (
                        <div className="space-y-5 pt-5">
                            <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                                <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                                    Registration
                                </h3>
                                <div className="grid gap-4 lg:grid-cols-2">
                                    <Field label="Tax Number">
                                        <Input
                                            value={draft.tax_number}
                                            onChange={(e) => set('tax_number', e.target.value)}
                                            className="text-xs font-mono"
                                        />
                                    </Field>
                                    <Field label="VAT Number">
                                        <Input
                                            value={draft.vat_number}
                                            onChange={(e) => set('vat_number', e.target.value)}
                                            className="text-xs font-mono"
                                        />
                                    </Field>
                                    <Field label="Registration Number">
                                        <Input
                                            value={draft.registration_number}
                                            onChange={(e) =>
                                                set('registration_number', e.target.value)
                                            }
                                            className="text-xs font-mono"
                                        />
                                    </Field>
                                </div>
                            </section>
                        </div>
                    )}

                    {activeTab === 'financial' && (
                        <div className="space-y-5 pt-5">
                            <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                                <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                                    Terms
                                </h3>
                                <div className="grid gap-4 lg:grid-cols-3">
                                    <Field label="Credit Limit">
                                        <Input
                                            type="number"
                                            min={0}
                                            step="0.01"
                                            value={draft.credit_limit}
                                            onChange={(e) => set('credit_limit', e.target.value)}
                                            placeholder="—"
                                            className="text-xs font-mono"
                                        />
                                    </Field>
                                    <Field label="Payment Terms (days)">
                                        <Input
                                            type="number"
                                            min={0}
                                            max={365}
                                            value={draft.payment_term_days}
                                            onChange={(e) =>
                                                set('payment_term_days', e.target.value)
                                            }
                                            placeholder="e.g. 30"
                                            className="text-xs font-mono"
                                        />
                                    </Field>
                                    <Field label="Currency">
                                        <Input
                                            value={draft.currency}
                                            onChange={(e) =>
                                                set('currency', e.target.value.toUpperCase())
                                            }
                                            maxLength={3}
                                            className="text-xs font-mono uppercase"
                                        />
                                    </Field>
                                </div>
                            </section>
                        </div>
                    )}

                    {activeTab === 'address' && (
                        <div className="space-y-5 pt-5">
                            <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                                <h3 className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-500">
                                    {mode === 'create' ? 'Primary Address' : 'Addresses'}
                                </h3>
                                {mode === 'edit' ? (
                                    <p className="text-slate-400">
                                        Addresses are managed on the partner profile, where
                                        each one can be set as the default for billing or
                                        shipping.
                                    </p>
                                ) : (
                                    <>
                                        <p className="mb-4 text-slate-400">
                                            Becomes the default for both billing and shipping.
                                            More can be added later.
                                        </p>
                                        <div className="grid gap-4 lg:grid-cols-2">
                                            <Field label="Country">
                                                <Input value={draft.country} onChange={(e) => set('country', e.target.value)} className="text-xs font-mono" />
                                            </Field>
                                            <Field label="Province / City">
                                                <Input value={draft.province} onChange={(e) => set('province', e.target.value)} className="text-xs font-mono" />
                                            </Field>
                                            <Field label="District">
                                                <Input value={draft.district} onChange={(e) => set('district', e.target.value)} className="text-xs font-mono" />
                                            </Field>
                                            <Field label="Commune">
                                                <Input value={draft.commune} onChange={(e) => set('commune', e.target.value)} className="text-xs font-mono" />
                                            </Field>
                                            <Field label="Street">
                                                <Input value={draft.street} onChange={(e) => set('street', e.target.value)} className="text-xs font-mono" />
                                            </Field>
                                            <Field label="Postal Code">
                                                <Input value={draft.postal_code} onChange={(e) => set('postal_code', e.target.value)} className="text-xs font-mono" />
                                            </Field>
                                        </div>
                                    </>
                                )}
                            </section>
                        </div>
                    )}

                    {activeTab === 'notes' && (
                        <div className="space-y-5 pt-5">
                            <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                                <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                                    Notes
                                </h3>
                                <textarea
                                    value={draft.notes}
                                    onChange={(e) => set('notes', e.target.value)}
                                    rows={6}
                                    placeholder="Anything the team should know about this partner…"
                                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                                />
                            </section>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function Field({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div className="space-y-1.5">
            <Label className="text-xs">{label}</Label>
            {children}
        </div>
    );
}
