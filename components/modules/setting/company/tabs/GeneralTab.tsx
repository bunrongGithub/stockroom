'use client';

import {
    EditableInput,
    EditableTextarea,
    FieldLabel,
} from '@/components/ui/FieldLabel';
import { companyApi } from '@/lib/api/company';
import type {
    Company,
    CompanyStatus,
    UpdateCompanyPayload,
} from '@/types/setting/company';
import { Loader2, PencilIcon, SaveIcon, XIcon } from 'lucide-react';
import { useState } from 'react';

const STATUS_OPTIONS: CompanyStatus[] = ['active', 'inactive', 'suspended'];

export default function GeneralTab({
    company,
    canUpdate,
    onSaved,
}: {
    company: Company;
    canUpdate: boolean;
    onSaved: (company: Company) => void;
}) {
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [form, setForm] = useState<UpdateCompanyPayload>({});

    function startEdit() {
        setForm({
            name: company.name,
            registration_number: company.registration_number ?? '',
            tax_number: company.tax_number ?? '',
            phone: company.phone ?? '',
            email: company.email ?? '',
            website: company.website ?? '',
            address: company.address ?? '',
            description: company.description ?? '',
            status: company.status,
        });
        setError('');
        setEditing(true);
    }

    async function save() {
        setSaving(true);
        setError('');
        try {
            const updated = await companyApi.update(form, company.id);
            setEditing(false);
            onSaved(updated);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to save company');
        } finally {
            setSaving(false);
        }
    }

    const set = (key: keyof UpdateCompanyPayload) => (value: string) =>
        setForm((f) => ({ ...f, [key]: value }));

    function ViewField({
        label,
        value,
    }: {
        label: string;
        value: string | null;
    }) {
        return (
            <div>
                <FieldLabel>{label}</FieldLabel>
                <p className="text-sm text-slate-800">{value || '—'}</p>
            </div>
        );
    }

    return (
        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    General Information
                </h3>
                {canUpdate && !editing && (
                    <button
                        onClick={startEdit}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-violet-200 px-3 py-2 text-violet-600 hover:bg-violet-50"
                    >
                        <PencilIcon size={13} /> Edit
                    </button>
                )}
                {editing && (
                    <div className="flex gap-1.5">
                        <button
                            onClick={() => setEditing(false)}
                            disabled={saving}
                            className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 hover:bg-muted"
                        >
                            <XIcon size={13} /> Cancel
                        </button>
                        <button
                            onClick={save}
                            disabled={saving}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-500 disabled:opacity-60"
                        >
                            {saving ? (
                                <Loader2 size={13} className="animate-spin" />
                            ) : (
                                <SaveIcon size={13} />
                            )}
                            Save
                        </button>
                    </div>
                )}
            </div>

            {error && (
                <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700">
                    {error}
                </div>
            )}

            {!editing ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <ViewField label="Company Name" value={company.name} />
                    <ViewField
                        label="Registration Number"
                        value={company.registration_number}
                    />
                    <ViewField label="Tax Number" value={company.tax_number} />
                    <ViewField label="Phone" value={company.phone} />
                    <ViewField label="Email" value={company.email} />
                    <ViewField label="Website" value={company.website} />
                    <div className="md:col-span-2 lg:col-span-3">
                        <ViewField label="Address" value={company.address} />
                    </div>
                    <div className="md:col-span-2 lg:col-span-3">
                        <ViewField
                            label="Description"
                            value={company.description}
                        />
                    </div>
                    <ViewField
                        label="Created"
                        value={new Date(company.created_at).toLocaleString()}
                    />
                    <ViewField
                        label="Last Updated"
                        value={
                            company.updated_at
                                ? new Date(company.updated_at).toLocaleString()
                                : null
                        }
                    />
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <div>
                        <FieldLabel required>Company Name</FieldLabel>
                        <EditableInput
                            value={form.name ?? ''}
                            onChange={(e) => set('name')(e.target.value)}
                        />
                    </div>
                    <div>
                        <FieldLabel>Registration Number</FieldLabel>
                        <EditableInput
                            value={form.registration_number ?? ''}
                            onChange={(e) =>
                                set('registration_number')(e.target.value)
                            }
                        />
                    </div>
                    <div>
                        <FieldLabel>Tax Number</FieldLabel>
                        <EditableInput
                            value={form.tax_number ?? ''}
                            onChange={(e) => set('tax_number')(e.target.value)}
                        />
                    </div>
                    <div>
                        <FieldLabel>Phone</FieldLabel>
                        <EditableInput
                            value={form.phone ?? ''}
                            onChange={(e) => set('phone')(e.target.value)}
                        />
                    </div>
                    <div>
                        <FieldLabel>Email</FieldLabel>
                        <EditableInput
                            type="email"
                            value={form.email ?? ''}
                            onChange={(e) => set('email')(e.target.value)}
                        />
                    </div>
                    <div>
                        <FieldLabel>Website</FieldLabel>
                        <EditableInput
                            value={form.website ?? ''}
                            onChange={(e) => set('website')(e.target.value)}
                        />
                    </div>
                    <div>
                        <FieldLabel>Status</FieldLabel>
                        <select
                            value={form.status ?? 'active'}
                            onChange={(e) =>
                                setForm((f) => ({
                                    ...f,
                                    status: e.target.value as CompanyStatus,
                                }))
                            }
                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none"
                        >
                            {STATUS_OPTIONS.map((s) => (
                                <option key={s} value={s}>
                                    {s}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="md:col-span-2 lg:col-span-3">
                        <FieldLabel>Address</FieldLabel>
                        <EditableTextarea
                            value={form.address ?? ''}
                            onChange={(e) => set('address')(e.target.value)}
                        />
                    </div>
                    <div className="md:col-span-2 lg:col-span-3">
                        <FieldLabel>Description</FieldLabel>
                        <EditableTextarea
                            value={form.description ?? ''}
                            onChange={(e) => set('description')(e.target.value)}
                        />
                    </div>
                </div>
            )}
        </section>
    );
}
