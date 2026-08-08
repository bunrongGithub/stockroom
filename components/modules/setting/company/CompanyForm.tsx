'use client';

import {
    EditableInput,
    EditableTextarea,
    FieldLabel,
} from '@/components/ui/FieldLabel';
import { FieldGrid, SectionCard } from '@/components/ui/FormShell';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import SelectDropdown from '@/components/ui/SelectDropdown';
import { companyApi } from '@/lib/api/company';
import type { Company, CompanyStatus } from '@/types/setting/company';
import {
    AlertCircle,
    ArrowLeft,
    Building2,
    MapPin,
    Save,
    X,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const STATUS_OPTIONS: CompanyStatus[] = ['active', 'inactive', 'suspended'];

const LIST_URL = '/setting/company';

export default function CompanyForm({
    mode,
    initial,
}: {
    mode: 'create' | 'edit';
    initial?: Company;
}) {
    const router = useRouter();
    const toast = useToast();

    const [name, setName] = useState(initial?.name ?? '');
    const [registrationNumber, setRegistrationNumber] = useState(
        initial?.registration_number ?? '',
    );
    const [taxNumber, setTaxNumber] = useState(initial?.tax_number ?? '');
    const [phone, setPhone] = useState(initial?.phone ?? '');
    const [email, setEmail] = useState(initial?.email ?? '');
    const [website, setWebsite] = useState(initial?.website ?? '');
    const [address, setAddress] = useState(initial?.address ?? '');
    const [description, setDescription] = useState(initial?.description ?? '');
    const [status, setStatus] = useState<CompanyStatus>(
        initial?.status ?? 'active',
    );

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError('');
        if (name.trim().length < 2) return setError('Company name is required');

        const payload = {
            name: name.trim(),
            registration_number: registrationNumber.trim(),
            tax_number: taxNumber.trim(),
            phone: phone.trim(),
            email: email.trim(),
            website: website.trim(),
            address: address.trim(),
            description: description.trim(),
            status,
        };

        setSaving(true);
        try {
            if (mode === 'create') {
                const company = await companyApi.create(payload);
                toast.success(`Company ${company.name} created.`);
                router.push(`${LIST_URL}/${company.id}/view`);
            } else {
                await companyApi.update(payload, initial!.id);
                toast.success('Company updated.');
                router.push(`${LIST_URL}/${initial!.id}/view`);
            }
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save');
        } finally {
            setSaving(false);
        }
    }

    return (
        // The form wraps the header too, so the Save button in the top-right
        // is a real submit and Enter still saves from any field.
        <form onSubmit={handleSubmit} className="space-y-4 font-mono text-xs">
            {/* Header — back link, title, and the Discard / Save pair */}
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <Link
                        href={LIST_URL}
                        className="inline-flex items-center gap-2 text-slate-500 transition-colors hover:text-slate-700"
                    >
                        <ArrowLeft size={16} /> Back to Companies
                    </Link>
                    <h2 className="mt-3 flex items-center gap-2 text-2xl font-bold text-slate-800 md:text-3xl">
                        <Building2 className="text-[#1a9e52]" />
                        {mode === 'create'
                            ? 'New Company'
                            : `Edit ${initial?.name ?? 'Company'}`}
                    </h2>
                </div>
                <div className="flex items-center gap-2">
                    <Link
                        href={LIST_URL}
                        className="rounded-xl border border-slate-200 px-4 py-2.5 text-slate-600 transition-colors hover:bg-slate-50"
                    >
                        Discard
                    </Link>
                    <button
                        type="submit"
                        disabled={saving}
                        className="flex items-center justify-center gap-2 rounded-xl bg-[#1a9e52] px-4 py-2.5 font-semibold text-white transition-colors hover:bg-[#158042] disabled:opacity-50"
                    >
                        {saving ? (
                            <Spinner size={16} className="text-current" />
                        ) : (
                            <Save size={16} />
                        )}
                        {saving ? 'Saving…' : 'Save'}
                    </button>
                </div>
            </div>

            {error && (
                <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                    <AlertCircle
                        size={18}
                        className="mt-0.5 shrink-0 text-red-500"
                    />
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

            <SectionCard
                icon={<Building2 size={13} />}
                title="Company Information"
            >
                <FieldGrid>
                    <div className="lg:col-span-2">
                        <FieldLabel required>Company Name</FieldLabel>
                        <EditableInput
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Acme Corporation"
                            autoFocus
                        />
                    </div>
                    <div>
                        <FieldLabel>Registration Number</FieldLabel>
                        <EditableInput
                            value={registrationNumber}
                            onChange={(e) =>
                                setRegistrationNumber(e.target.value)
                            }
                            placeholder="Optional"
                        />
                    </div>
                    <div>
                        <FieldLabel>Tax Number</FieldLabel>
                        <EditableInput
                            value={taxNumber}
                            onChange={(e) => setTaxNumber(e.target.value)}
                            placeholder="Optional"
                        />
                    </div>
                    <SelectDropdown
                        label="Status"
                        options={STATUS_OPTIONS.map((s) => ({
                            value: s,
                            label: s,
                        }))}
                        value={status}
                        onChange={(v) => setStatus(v as CompanyStatus)}
                    />
                    <div className="lg:col-span-2">
                        <FieldLabel>Description</FieldLabel>
                        <EditableTextarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={3}
                            placeholder="Optional"
                        />
                    </div>
                </FieldGrid>
            </SectionCard>

            <SectionCard
                icon={<MapPin size={13} />}
                title="Contact &amp; Address"
            >
                <FieldGrid>
                    <div>
                        <FieldLabel>Phone</FieldLabel>
                        <EditableInput
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="Optional"
                        />
                    </div>
                    <div>
                        <FieldLabel>Email</FieldLabel>
                        <EditableInput
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="company@example.com"
                        />
                    </div>
                    <div className="lg:col-span-2">
                        <FieldLabel>Website</FieldLabel>
                        <EditableInput
                            value={website}
                            onChange={(e) => setWebsite(e.target.value)}
                            placeholder="https://..."
                        />
                    </div>
                    <div className="lg:col-span-2">
                        <FieldLabel>Address</FieldLabel>
                        <EditableTextarea
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            rows={3}
                            placeholder="Optional"
                        />
                    </div>
                </FieldGrid>
            </SectionCard>
        </form>
    );
}
