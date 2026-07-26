'use client';

/**
 * The partner picker every module uses. Sales today; Purchasing, Payments and
 * CRM tomorrow with nothing but a different `role`.
 *
 * Search matches code, name or phone — whichever the user happens to have — and
 * the inline quick-create means a new customer never forces a detour into
 * Master Data mid-transaction.
 */

import EntityLookup from '@/components/ui/EntityLookup';
import { PartnerRoleBadge } from '@/components/ui/PartnerRoleBadge';
import { businessPartnerApi } from '@/lib/api/business-partner';
import type { BusinessPartnerOption } from '@/types/master-data/business-partner';
import { Loader2, UserPlus, X } from 'lucide-react';
import { useState } from 'react';

function PartnerRow({ p }: { p: BusinessPartnerOption }) {
    return (
        <span className="flex items-center gap-2">
            <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-gray-500">
                {p.code}
            </span>
            <span className="min-w-0 flex-1">
                <span className="block truncate font-mono text-xs text-slate-800">
                    {p.name}
                </span>
                {p.phone && (
                    <span className="block truncate text-[10px] text-slate-400">
                        {p.phone}
                    </span>
                )}
            </span>
            <span className="flex shrink-0 gap-1">
                {p.roles?.slice(0, 3).map((r) => (
                    <PartnerRoleBadge key={r} role={r} iconOnly />
                ))}
            </span>
        </span>
    );
}

export default function BusinessPartnerLookup({
    value,
    onChange,
    role = 'customer',
    label = 'Business Partner',
    placeholder = 'Search by code, name or phone…',
    required,
    disabled,
    autoFocus,
    allowCreate = true,
}: {
    value: BusinessPartnerOption | null;
    onChange: (partner: BusinessPartnerOption | null) => void;
    /** Restricts the list, and the role a quick-created partner receives. */
    role?: 'customer' | 'supplier' | 'carrier' | 'employee' | 'vendor';
    label?: string;
    placeholder?: string;
    required?: boolean;
    disabled?: boolean;
    autoFocus?: boolean;
    allowCreate?: boolean;
}) {
    const [creating, setCreating] = useState<{ name: string; phone: string } | null>(
        null,
    );
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');

    /** Digits typed into the box are a phone; anything else is a name. */
    function startCreate(typed: string) {
        const isPhone = /^[\d\s+()-]+$/.test(typed) && /\d/.test(typed);
        setError('');
        setCreating({
            name: isPhone ? '' : typed,
            phone: isPhone ? typed : '',
        });
    }

    async function submitCreate() {
        if (!creating?.name.trim() || saving) return;
        setSaving(true);
        setError('');
        try {
            const { partner, matched } = await businessPartnerApi.quickCreate({
                name: creating.name.trim(),
                phone: creating.phone.trim() || null,
                role,
            });
            onChange({
                id: partner.id,
                code: partner.code,
                name: partner.name,
                phone: partner.phone,
                roles: partner.roles ?? [role],
            });
            // Reusing an existing record is the desired outcome, not an error —
            // say so plainly so the user knows why the name may differ.
            setNotice(
                matched
                    ? `Existing partner ${partner.code} — ${partner.name} already uses that phone, so they were selected.`
                    : '',
            );
            setCreating(null);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not create partner');
        } finally {
            setSaving(false);
        }
    }

    if (creating) {
        return (
            <div className="space-y-2 rounded-xl border border-[#1a9e52]/40 bg-emerald-50/40 p-3">
                <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-[#1a9e52]">
                        <UserPlus size={13} /> New {role}
                    </span>
                    <button
                        type="button"
                        onClick={() => setCreating(null)}
                        className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
                        aria-label="Cancel"
                    >
                        <X size={13} />
                    </button>
                </div>

                <input
                    autoFocus
                    value={creating.name}
                    onChange={(e) => setCreating({ ...creating, name: e.target.value })}
                    onKeyDown={(e) => e.key === 'Enter' && void submitCreate()}
                    placeholder="Name *"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-mono focus:border-[#1a9e52] focus:outline-none"
                />
                <input
                    value={creating.phone}
                    onChange={(e) => setCreating({ ...creating, phone: e.target.value })}
                    onKeyDown={(e) => e.key === 'Enter' && void submitCreate()}
                    placeholder="Phone"
                    inputMode="tel"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-mono focus:border-[#1a9e52] focus:outline-none"
                />

                {error && <p className="text-[11px] text-rose-600">{error}</p>}

                <button
                    type="button"
                    onClick={submitCreate}
                    disabled={saving || !creating.name.trim()}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#1a9e52] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#158042] disabled:opacity-50"
                >
                    {saving && <Loader2 size={13} className="animate-spin" />}
                    Save &amp; continue
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-1">
            <EntityLookup<BusinessPartnerOption>
                endpoint={businessPartnerApi.lookupUrl}
                params={{ role }}
                recentsScope={`partner_${role}`}
                value={value}
                onSelect={(p) => {
                    setNotice('');
                    onChange(p);
                }}
                label={label}
                placeholder={placeholder}
                required={required}
                disabled={disabled}
                autoFocus={autoFocus}
                emptyText="No partner found"
                createLabel={allowCreate ? 'Create partner' : undefined}
                onCreateNew={allowCreate ? startCreate : undefined}
                renderRow={(p) => <PartnerRow p={p} />}
                renderValue={(p) => (
                    <span className="flex items-center gap-2">
                        <span className="shrink-0 rounded bg-white px-1.5 py-0.5 font-mono text-[10px] text-gray-600">
                            {p.code}
                        </span>
                        <span className="truncate font-mono text-xs text-slate-800">
                            {p.name}
                        </span>
                        {p.phone && (
                            <span className="shrink-0 text-[10px] text-slate-500">
                                {p.phone}
                            </span>
                        )}
                    </span>
                )}
            />
            {notice && <p className="text-[10px] text-emerald-600">{notice}</p>}
        </div>
    );
}
