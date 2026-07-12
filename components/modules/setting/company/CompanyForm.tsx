'use client';

import {
    EditableInput,
    EditableTextarea,
    FieldLabel,
} from '@/components/ui/FieldLabel';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import SelectDropdown from '@/components/ui/SelectDropdown';
import { companyApi } from '@/lib/api/company';
import type { Company, CompanyStatus } from '@/types/setting/company';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const STATUS_OPTIONS: CompanyStatus[] = ['active', 'inactive', 'suspended'];

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
                router.push(`/setting/company/${company.id}/view`);
            } else {
                await companyApi.update(payload, initial!.id);
                toast.success('Company updated.');
                router.push(`/setting/company/${initial!.id}/view`);
            }
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save');
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="mx-auto max-w-2xl space-y-4">
            <button
                type="button"
                onClick={() => router.push('/setting/company')}
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
                <ArrowLeft size={16} /> Back to Companies
            </button>

            <PageHeader
                title={
                    mode === 'create'
                        ? 'New Company'
                        : `Edit ${initial?.name ?? ''}`
                }
                description="Company profile and legal information."
            />

            {error && (
                <div className="rounded-xl border border-danger/30 bg-danger-muted px-4 py-3 text-sm text-danger">
                    {error}
                </div>
            )}

            <form
                onSubmit={handleSubmit}
                className="space-y-5 rounded-2xl border border-border/60 bg-card p-5 shadow-sm"
            >
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
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
                    <div>
                        <FieldLabel>Website</FieldLabel>
                        <EditableInput
                            value={website}
                            onChange={(e) => setWebsite(e.target.value)}
                            placeholder="https://..."
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
                    <div className="sm:col-span-2">
                        <FieldLabel>Address</FieldLabel>
                        <EditableTextarea
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            placeholder="Optional"
                        />
                    </div>
                    <div className="sm:col-span-2">
                        <FieldLabel>Description</FieldLabel>
                        <EditableTextarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Optional"
                        />
                    </div>
                </div>

                <div className="flex flex-col-reverse gap-2 border-t border-border/40 pt-4 sm:flex-row sm:justify-end">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => router.push('/setting/company')}
                    >
                        Cancel
                    </Button>
                    <Button type="submit" disabled={saving}>
                        {saving && <Spinner size={15} className="text-current" />}
                        {mode === 'create' ? 'Create Company' : 'Save Changes'}
                    </Button>
                </div>
            </form>
        </div>
    );
}
