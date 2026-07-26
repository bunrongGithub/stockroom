'use client';

import { AuditInformationCard } from '@/components/ui/AuditInformationCard';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import PartnerRoleBadges from '@/components/ui/PartnerRoleBadge';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useRegisterModule } from '@/hook/useModule';
import { businessPartnerApi } from '@/lib/api/business-partner';
import type { ModuleProps } from '@/lib/registry';
import type { AuditMeta } from '@/types/audit';
import type {
    BusinessPartner,
    BusinessPartnerSummary,
} from '@/types/master-data/business-partner';
import {
    ArrowLeftIcon,
    Building2,
    CalendarClock,
    FileWarning,
    Loader2Icon,
    MapPin,
    PencilIcon,
    Power,
    Receipt,
    Users,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

const TABS = [
    { id: 'overview' as const, label: 'Overview' },
    { id: 'sales' as const, label: 'Sales' },
    { id: 'addresses' as const, label: 'Addresses' },
    { id: 'contacts' as const, label: 'Contacts' },
    { id: 'financial' as const, label: 'Financial' },
    { id: 'analytics' as const, label: 'Analytics' },
    { id: 'documents' as const, label: 'Documents' },
    { id: 'activities' as const, label: 'Activities' },
];
type TabId = (typeof TABS)[number]['id'];

const money = (n: number, currency = 'USD') =>
    `${currency} ${n.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;

const dateOnly = (v: string | null | undefined) =>
    v ? new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : null;

/**
 * The Business Partner profile — the relationship hub. Everything the ERP
 * knows about one partner in one place, with tabs that fill in as more of the
 * system links to them.
 */
export default function BusinessPartnerDetail({
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
    const params = useParams();
    const id = Number(Array.isArray(params.slug) ? params.slug.at(-2) : params.slug);

    const [partner, setPartner] = useState<BusinessPartner | null>(null);
    const [summary, setSummary] = useState<BusinessPartnerSummary | null>(null);
    const [activeTab, setActiveTab] = useState<TabId>('overview');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        try {
            const p = await businessPartnerApi.get(id);
            setPartner(p);
            // Summary is best-effort: the profile still renders if aggregates fail.
            setSummary(await businessPartnerApi.summary(id).catch(() => null));
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load partner');
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        if (!id) return;
        let active = true;
        // Deferred so nothing is set synchronously during the effect, and
        // discarded if the profile unmounts mid-flight.
        void (async () => {
            if (active) await load();
        })();
        return () => {
            active = false;
        };
    }, [id, load]);

    async function toggleStatus() {
        if (!partner || busy) return;
        setBusy(true);
        try {
            await businessPartnerApi.setStatus(partner.id, !partner.is_active);
            await load();
        } finally {
            setBusy(false);
        }
    }

    if (loading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loader2Icon className="animate-spin text-emerald-500" size={26} />
            </div>
        );
    }

    if (error || !partner) {
        return (
            <div className="flex h-64 flex-col items-center justify-center gap-3">
                <FileWarning className="text-muted-foreground" size={40} />
                <p className="text-sm text-muted-foreground">
                    {error || 'Business partner not found.'}
                </p>
                <button
                    onClick={() => router.push('/master-data/business-partner')}
                    className="text-xs text-sky-600 hover:underline"
                >
                    Back to list
                </button>
            </div>
        );
    }

    return (
        <div className="mx-auto space-y-3 font-mono text-xs">
            <Link
                href="/master-data/business-partner"
                className="inline-flex items-center gap-2 text-slate-500 transition-colors hover:text-slate-700"
            >
                <ArrowLeftIcon size={16} /> Back to Business Partners
            </Link>

            {/* Header */}
            <div className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                    <Avatar name={partner.name} size={48} />
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-xl font-bold text-slate-800">
                                {partner.name}
                            </h2>
                            <span className="rounded bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">
                                {partner.code}
                            </span>
                            <StatusBadge
                                status={partner.is_active ? 'ACTIVE' : 'INACTIVE'}
                            />
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-slate-400">
                            {partner.company_name && <span>{partner.company_name}</span>}
                            {partner.phone && <span>· {partner.phone}</span>}
                            {partner.email && <span>· {partner.email}</span>}
                        </div>
                        <div className="mt-2">
                            <PartnerRoleBadges roles={partner.roles} />
                        </div>
                    </div>
                </div>
                <div className="flex shrink-0 gap-2">
                    <Link
                        href={`/master-data/business-partner/${partner.id}/update`}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-violet-200 px-4 py-2.5 text-violet-600 transition-colors hover:bg-violet-50"
                    >
                        <PencilIcon size={14} /> Edit
                    </Link>
                    <button
                        onClick={toggleStatus}
                        disabled={busy}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
                    >
                        <Power size={14} />
                        {partner.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-0 overflow-x-auto border-b border-slate-200">
                {TABS.map((tab) => (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        className={`shrink-0 border-b-2 px-5 py-3 transition-all ${
                            activeTab === tab.id
                                ? 'border-[#1a9e52] text-[#1a9e52]'
                                : 'border-transparent text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {activeTab === 'overview' && (
                <OverviewTab partner={partner} summary={summary} />
            )}
            {activeTab === 'sales' && <SalesTab partnerId={partner.id} />}
            {activeTab === 'addresses' && <AddressesTab partner={partner} />}
            {activeTab === 'contacts' && <ContactsTab partner={partner} />}
            {activeTab === 'financial' && (
                <FinancialTab partner={partner} summary={summary} />
            )}
            {activeTab === 'analytics' && (
                <div className="pt-5">
                    <EmptyState
                        icon={CalendarClock}
                        title="Analytics coming soon"
                        description="Monthly sales trend for this partner will appear here once the shared timeseries is scoped per partner."
                    />
                </div>
            )}
            {activeTab === 'documents' && (
                <div className="pt-5">
                    <EmptyState
                        title="No documents yet"
                        description="Attachments — contracts, licences, agreements — will live here."
                    />
                </div>
            )}
            {activeTab === 'activities' && (
                <div className="pt-5">
                    <EmptyState
                        title="No activity recorded"
                        description="Calls, visits and follow-ups will be logged here when CRM lands."
                    />
                </div>
            )}

            <AuditInformationCard audit={partner as Partial<AuditMeta>} />
        </div>
    );
}

// ── Overview ────────────────────────────────────────────────────────────────

function StatTile({
    label,
    value,
    hint,
}: {
    label: string;
    value: string;
    hint?: string | null;
}) {
    return (
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <p className="text-[11px] uppercase tracking-wider text-slate-400">{label}</p>
            <p className="mt-1 text-lg font-bold text-slate-800">{value}</p>
            {hint && <p className="mt-0.5 text-[10px] text-slate-400">{hint}</p>}
        </div>
    );
}

function OverviewTab({
    partner,
    summary,
}: {
    partner: BusinessPartner;
    summary: BusinessPartnerSummary | null;
}) {
    const cur = summary?.currency ?? partner.currency;
    // A partner with no history shows an em dash rather than a misleading zero.
    const dash = '—';
    return (
        <div className="space-y-5 pt-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <StatTile
                    label="Lifetime Sales"
                    value={summary ? money(summary.lifetime_sales, cur) : dash}
                />
                <StatTile
                    label="Outstanding Balance"
                    value={summary ? money(summary.outstanding, cur) : dash}
                    hint={
                        partner.credit_limit != null
                            ? `Credit limit ${money(Number(partner.credit_limit), cur)}`
                            : null
                    }
                />
                <StatTile
                    label="Orders"
                    value={summary ? String(summary.order_count) : dash}
                />
                <StatTile
                    label="Average Order Value"
                    value={
                        summary && summary.order_count > 0
                            ? money(summary.average_order_value, cur)
                            : dash
                    }
                />
                <StatTile
                    label="Last Purchase"
                    value={dateOnly(summary?.last_purchase_at) ?? dash}
                />
                <StatTile
                    label="Last Payment"
                    value={dateOnly(summary?.last_payment_at) ?? dash}
                />
            </div>

            <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                <h3 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                    <Building2 size={13} className="text-[#1a9e52]" /> Details
                </h3>
                <div className="grid grid-cols-2 gap-y-3 lg:grid-cols-4">
                    <Detail label="Partner Code" value={partner.code} />
                    <Detail label="Type" value={partner.partner_kind} />
                    <Detail label="Phone" value={partner.phone} />
                    <Detail label="Alt Phone" value={partner.phone_alt} />
                    <Detail label="Email" value={partner.email} />
                    <Detail label="Website" value={partner.website} />
                    <Detail label="Tax Number" value={partner.tax_number} />
                    <Detail label="VAT Number" value={partner.vat_number} />
                    <Detail label="Registration No" value={partner.registration_number} />
                    <Detail label="Currency" value={partner.currency} />
                </div>
                {partner.notes && (
                    <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 whitespace-pre-wrap text-slate-600">
                        {partner.notes}
                    </div>
                )}
            </section>
        </div>
    );
}

function Detail({ label, value }: { label: string; value?: string | null }) {
    return (
        <>
            <span className="text-slate-400">{label}</span>
            <span className="capitalize text-slate-700">{value || '—'}</span>
        </>
    );
}

// ── Sales ───────────────────────────────────────────────────────────────────

const DOC_TYPES = [
    { id: 'orders' as const, label: 'Sales Orders', noCol: 'order_no', dateCol: 'order_date', href: '/sale/order' },
    { id: 'shipments' as const, label: 'Shipments', noCol: 'shipment_no', dateCol: 'delivery_date', href: '/sale/delivery-note' },
    { id: 'invoices' as const, label: 'Invoices', noCol: 'invoice_no', dateCol: 'invoice_date', href: '/finances/invoice' },
    { id: 'payments' as const, label: 'Payments', noCol: 'payment_no', dateCol: 'payment_date', href: '/finances/payment' },
];

function SalesTab({ partnerId }: { partnerId: number }) {
    const [type, setType] = useState<(typeof DOC_TYPES)[number]>(DOC_TYPES[0]);
    const [rows, setRows] = useState<Record<string, unknown>[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;
        void (async () => {
            if (!active) return;
            setLoading(true);
            try {
                const r = await businessPartnerApi.transactions(partnerId, type.id, {
                    limit: 20,
                });
                if (active) setRows(r.data);
            } catch {
                if (active) setRows([]);
            } finally {
                if (active) setLoading(false);
            }
        })();
        return () => {
            active = false;
        };
    }, [partnerId, type]);

    return (
        <div className="space-y-4 pt-5">
            <div className="flex flex-wrap gap-2">
                {DOC_TYPES.map((t) => (
                    <button
                        key={t.id}
                        onClick={() => setType(t)}
                        className={`rounded-xl border px-3 py-1.5 transition-colors ${
                            type.id === t.id
                                ? 'border-[#1a9e52] bg-emerald-50 text-[#1a9e52]'
                                : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                {loading ? (
                    <div className="flex h-24 items-center justify-center">
                        <Loader2Icon className="animate-spin text-emerald-500" size={20} />
                    </div>
                ) : rows.length === 0 ? (
                    <EmptyState
                        icon={Receipt}
                        compact
                        title={`No ${type.label.toLowerCase()} yet`}
                        description="Documents raised for this partner will appear here."
                    />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead className="border-b text-slate-400">
                                <tr>
                                    <th className="py-2 pr-3 text-left font-medium">Number</th>
                                    <th className="py-2 pr-3 text-left font-medium">Date</th>
                                    <th className="py-2 pr-3 text-left font-medium">Status</th>
                                    <th className="py-2 text-right font-medium">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row) => {
                                    const amount =
                                        (row.grand_total as number) ??
                                        (row.amount as number) ??
                                        null;
                                    return (
                                        <tr key={String(row.id)} className="border-b hover:bg-muted/20">
                                            <td className="py-2 pr-3">
                                                <Link
                                                    href={`${type.href}/${row.id}/view`}
                                                    className="text-sky-600 hover:underline"
                                                >
                                                    {String(row[type.noCol] ?? row.id)}
                                                </Link>
                                            </td>
                                            <td className="py-2 pr-3 text-slate-600">
                                                {dateOnly(row[type.dateCol] as string) ?? '—'}
                                            </td>
                                            <td className="py-2 pr-3">
                                                <StatusBadge status={String(row.status ?? '')} />
                                            </td>
                                            <td className="py-2 text-right tabular-nums text-slate-700">
                                                {amount != null ? Number(amount).toFixed(2) : '—'}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
    );
}

// ── Addresses & contacts ────────────────────────────────────────────────────

function AddressesTab({ partner }: { partner: BusinessPartner }) {
    const addresses = partner.addresses ?? [];
    return (
        <div className="space-y-4 pt-5">
            {addresses.length === 0 ? (
                <EmptyState
                    icon={MapPin}
                    title="No addresses"
                    description="Add an address from the edit form to enable billing and shipping defaults."
                />
            ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                    {addresses.map((a) => (
                        <div
                            key={a.id}
                            className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"
                        >
                            <div className="flex items-center justify-between">
                                <span className="font-semibold text-slate-700">
                                    {a.label || a.address_type}
                                </span>
                                <span className="flex gap-1">
                                    {a.is_default_billing && (
                                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-600">
                                            Billing
                                        </span>
                                    )}
                                    {a.is_default_shipping && (
                                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                                            Shipping
                                        </span>
                                    )}
                                </span>
                            </div>
                            <p className="mt-2 text-slate-500">
                                {[a.street, a.commune, a.district, a.province, a.country]
                                    .filter(Boolean)
                                    .join(', ') || '—'}
                                {a.postal_code ? ` (${a.postal_code})` : ''}
                            </p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function ContactsTab({ partner }: { partner: BusinessPartner }) {
    const contacts = partner.contacts ?? [];
    return (
        <div className="space-y-4 pt-5">
            {contacts.length === 0 ? (
                <EmptyState
                    icon={Users}
                    title="No contacts"
                    description="People to reach at this partner will be listed here."
                />
            ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                    {contacts.map((c) => (
                        <div
                            key={c.id}
                            className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"
                        >
                            <Avatar name={c.name} size={34} />
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="font-semibold text-slate-700">{c.name}</span>
                                    {c.is_primary && (
                                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                                            Primary
                                        </span>
                                    )}
                                </div>
                                <p className="text-slate-400">{c.position || '—'}</p>
                                <p className="mt-1 text-slate-500">
                                    {[c.phone, c.email].filter(Boolean).join(' · ') || '—'}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ── Financial ───────────────────────────────────────────────────────────────

function FinancialTab({
    partner,
    summary,
}: {
    partner: BusinessPartner;
    summary: BusinessPartnerSummary | null;
}) {
    const cur = partner.currency;
    const limit = partner.credit_limit != null ? Number(partner.credit_limit) : null;
    const outstanding = summary?.outstanding ?? 0;
    const usage = limit && limit > 0 ? Math.min(100, (outstanding / limit) * 100) : null;

    return (
        <div className="space-y-4 pt-5">
            <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                    Credit
                </h3>
                <div className="grid grid-cols-2 gap-y-3 lg:grid-cols-4">
                    <Detail label="Credit Limit" value={limit != null ? money(limit, cur) : null} />
                    <Detail label="Outstanding" value={money(outstanding, cur)} />
                    <Detail
                        label="Payment Terms"
                        value={
                            partner.payment_term_days != null
                                ? `Net ${partner.payment_term_days} days`
                                : null
                        }
                    />
                    <Detail label="Currency" value={cur} />
                </div>

                {usage !== null && (
                    <div className="mt-4">
                        <div className="mb-1 flex justify-between text-[10px] text-slate-400">
                            <span>Credit used</span>
                            <span>{usage.toFixed(0)}%</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                            <div
                                className={`h-full rounded-full ${
                                    usage > 90
                                        ? 'bg-rose-500'
                                        : usage > 70
                                          ? 'bg-amber-500'
                                          : 'bg-[#1a9e52]'
                                }`}
                                style={{ width: `${usage}%` }}
                            />
                        </div>
                    </div>
                )}
            </section>
        </div>
    );
}
