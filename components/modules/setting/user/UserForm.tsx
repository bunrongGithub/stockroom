'use client';

import { EditableInput, FieldLabel } from '@/components/ui/FieldLabel';
import { FieldGrid, SectionCard } from '@/components/ui/FormShell';
import { Switch } from '@/components/ui/switch';
import { Spinner } from '@/components/ui/Spinner';
import { Avatar } from '@/components/ui/Avatar';
import { useToast } from '@/components/ui/Toast';
import SelectDropdown from '@/components/ui/SelectDropdown';
import { useApp } from '@/context/AppContext';
import { API } from '@/lib/constant';
import { usersApi } from '@/lib/api/users';
import { companyApi } from '@/lib/api/company';
import type { Company } from '@/types/setting/company';
import type { CompanyUser } from '@/service/apps/base/user/repo/user.repo';
import {
    AlertCircle,
    ArrowLeft,
    Save,
    ShieldCheck,
    Upload,
    UserCircle,
    X,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type RoleOption = { id: number; name: string };

const LIST_URL = '/setting/users';

export default function UserForm({
    mode,
    initial,
}: {
    mode: 'create' | 'edit';
    initial?: CompanyUser;
}) {
    const router = useRouter();
    const toast = useToast();
    const { profile } = useApp();
    const fileRef = useRef<HTMLInputElement>(null);

    const [fullName, setFullName] = useState(initial?.full_name ?? '');
    const [email, setEmail] = useState(initial?.email ?? '');
    const [password, setPassword] = useState('');
    const [phone, setPhone] = useState(initial?.phone ?? '');
    const [isActive, setIsActive] = useState(
        initial ? initial.status === 'active' : true,
    );
    const [companyId, setCompanyId] = useState<number | null>(
        initial?.company_id ?? null,
    );
    const [roleId, setRoleId] = useState<number | null>(
        initial?.roles[0]?.id ?? null,
    );
    const [avatarUrl, setAvatarUrl] = useState(initial?.avatar_url ?? '');

    const [companies, setCompanies] = useState<Company[]>([]);
    const [roles, setRoles] = useState<RoleOption[]>([]);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');

    // Companies the caller may assign: super users get every company,
    // everyone else a single-row list with their own.
    useEffect(() => {
        (async () => {
            try {
                const res = await companyApi.list({ limit: 100 });
                setCompanies(res.data ?? []);
            } catch {
                /* company list is best-effort */
            }
        })();
    }, []);

    // Until the user picks a company, default to the caller's own.
    const effectiveCompanyId =
        companyId ?? (Number(profile?.companyId) || null);

    // Roles always belong to the selected company.
    useEffect(() => {
        if (!effectiveCompanyId) return;
        (async () => {
            try {
                const res = await fetch(
                    `${API.setting.role.root}?limit=1000&company_id=${effectiveCompanyId}`,
                );
                const body = await res.json();
                const list = (body.data ?? []) as RoleOption[];
                setRoles(list);
                // Drop a selection that doesn't exist in the new company.
                setRoleId((prev) =>
                    prev && list.some((r) => r.id === prev) ? prev : null,
                );
            } catch {
                /* roles list is best-effort */
            }
        })();
    }, [effectiveCompanyId]);

    async function handleAvatar(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file || !initial) return;
        setUploading(true);
        try {
            const updated = await usersApi.uploadAvatar(initial.id, file);
            setAvatarUrl(updated.avatar_url ?? '');
            toast.success('Avatar updated.');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Upload failed');
        } finally {
            setUploading(false);
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError('');
        if (!fullName.trim()) return setError('Full name is required');
        if (mode === 'create') {
            if (!email.trim()) return setError('Email is required');
            if (password.length < 8)
                return setError('Password must be at least 8 characters');
        }
        if (!effectiveCompanyId) return setError('Select a company');
        if (!roleId) return setError('Assign a role');

        setSaving(true);
        try {
            if (mode === 'create') {
                const user = await usersApi.create({
                    email: email.trim(),
                    full_name: fullName.trim(),
                    password,
                    phone: phone.trim() || undefined,
                    status: isActive ? 'active' : 'inactive',
                    company_id: effectiveCompanyId,
                    role_ids: [roleId],
                });
                toast.success(`User ${user.email} created.`);
                router.push(`${LIST_URL}/${user.id}/view`);
            } else {
                await usersApi.update(initial!.id, {
                    full_name: fullName.trim(),
                    phone: phone.trim(),
                    status: isActive ? 'active' : 'inactive',
                    company_id: effectiveCompanyId,
                    role_ids: [roleId],
                });
                toast.success('User updated.');
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
                        <ArrowLeft size={16} /> Back
                    </Link>
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
                icon={<UserCircle size={13} />}
                title="User Information"
            >
                {/* Avatar upload needs an existing user to attach the file to. */}
                {mode === 'edit' && (
                    <div className="mb-4 flex items-center gap-4">
                        <Avatar
                            src={avatarUrl}
                            name={fullName || email}
                            size={56}
                        />
                        <div>
                            <input
                                ref={fileRef}
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                className="hidden"
                                onChange={handleAvatar}
                            />
                            <button
                                type="button"
                                disabled={uploading}
                                onClick={() => fileRef.current?.click()}
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
                            >
                                {uploading ? (
                                    <Spinner
                                        size={14}
                                        className="text-current"
                                    />
                                ) : (
                                    <Upload size={14} />
                                )}
                                Change avatar
                            </button>
                        </div>
                    </div>
                )}

                <FieldGrid>
                    <div>
                        <FieldLabel required>Full Name</FieldLabel>
                        <EditableInput
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            placeholder="e.g. John Doe"
                            autoFocus
                        />
                    </div>
                    <div>
                        <FieldLabel required>Email</FieldLabel>
                        <EditableInput
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="john@example.com"
                            disabled={mode === 'edit'}
                        />
                        {mode === 'edit' && (
                            <p className="mt-1 text-[11px] text-slate-400">
                                Email can&apos;t be changed.
                            </p>
                        )}
                    </div>
                    {mode === 'create' && (
                        <div>
                            <FieldLabel required>Temporary Password</FieldLabel>
                            <EditableInput
                                type="text"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="At least 8 characters"
                            />
                            <p className="mt-1 text-[11px] text-slate-400">
                                Share this with the user; they can change it
                                later.
                            </p>
                        </div>
                    )}
                    <div>
                        <FieldLabel>Phone</FieldLabel>
                        <EditableInput
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="Optional"
                        />
                    </div>
                </FieldGrid>
            </SectionCard>

            <SectionCard
                icon={<ShieldCheck size={13} />}
                title="Company &amp; Access"
            >
                <FieldGrid>
                    <SelectDropdown
                        label="Company"
                        required
                        placeholder="Select a company..."
                        options={companies.map((c) => ({
                            value: c.id,
                            label: c.name,
                        }))}
                        value={effectiveCompanyId}
                        onChange={(v) => setCompanyId(Number(v))}
                        disabled={companies.length <= 1}
                    />
                    <div>
                        <SelectDropdown
                            label="Role"
                            required
                            placeholder="Select a role..."
                            options={roles.map((r) => ({
                                value: r.id,
                                label: r.name,
                            }))}
                            value={roleId}
                            onChange={(v) => setRoleId(Number(v))}
                        />
                        {roles.length === 0 && (
                            <p className="mt-1 text-[11px] text-slate-400">
                                No roles found for this company.
                            </p>
                        )}
                    </div>
                    <div>
                        <FieldLabel>Active</FieldLabel>
                        <label className="flex min-h-11.5 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 shadow-sm">
                            <Switch
                                checked={isActive}
                                onCheckedChange={(v: boolean) => setIsActive(v)}
                            />
                            <span
                                className={
                                    isActive
                                        ? 'font-semibold text-[#1a9e52]'
                                        : 'text-slate-400'
                                }
                            >
                                {isActive ? 'Active' : 'Inactive'}
                            </span>
                        </label>
                        <p className="mt-1 text-[11px] text-slate-400">
                            Inactive users can&apos;t log in.
                        </p>
                    </div>
                </FieldGrid>
            </SectionCard>
        </form>
    );
}
