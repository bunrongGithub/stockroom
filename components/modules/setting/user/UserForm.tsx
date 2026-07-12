'use client';

import {
    EditableInput,
    FieldLabel,
} from '@/components/ui/FieldLabel';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Spinner } from '@/components/ui/Spinner';
import { Avatar } from '@/components/ui/Avatar';
import { useToast } from '@/components/ui/Toast';
import { API } from '@/lib/constant';
import { usersApi } from '@/lib/api/users';
import type { CompanyUser } from '@/service/apps/base/user/repo/user.repo';
import { ArrowLeft, Check, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type RoleOption = { id: number; name: string };

export default function UserForm({
    mode,
    initial,
}: {
    mode: 'create' | 'edit';
    initial?: CompanyUser;
}) {
    const router = useRouter();
    const toast = useToast();
    const fileRef = useRef<HTMLInputElement>(null);

    const [fullName, setFullName] = useState(initial?.full_name ?? '');
    const [email, setEmail] = useState(initial?.email ?? '');
    const [password, setPassword] = useState('');
    const [phone, setPhone] = useState(initial?.phone ?? '');
    const [isActive, setIsActive] = useState(
        initial ? initial.status === 'active' : true,
    );
    const [roleIds, setRoleIds] = useState<Set<number>>(
        new Set(initial?.roles.map((r) => r.id) ?? []),
    );
    const [avatarUrl, setAvatarUrl] = useState(initial?.avatar_url ?? '');

    const [roles, setRoles] = useState<RoleOption[]>([]);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(`${API.setting.role.root}?limit=1000`);
                const body = await res.json();
                setRoles((body.data ?? []) as RoleOption[]);
            } catch {
                /* roles list is best-effort */
            }
        })();
    }, []);

    function toggleRole(id: number) {
        setRoleIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

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
        if (roleIds.size === 0) return setError('Assign at least one role');

        setSaving(true);
        try {
            if (mode === 'create') {
                const user = await usersApi.create({
                    email: email.trim(),
                    full_name: fullName.trim(),
                    password,
                    phone: phone.trim() || undefined,
                    status: isActive ? 'active' : 'inactive',
                    role_ids: [...roleIds],
                });
                toast.success(`User ${user.email} created.`);
                router.push(`/setting/users/${user.id}/view`);
            } else {
                await usersApi.update(initial!.id, {
                    full_name: fullName.trim(),
                    phone: phone.trim(),
                    status: isActive ? 'active' : 'inactive',
                    role_ids: [...roleIds],
                });
                toast.success('User updated.');
                router.push(`/setting/users/${initial!.id}/view`);
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
                onClick={() => router.push('/setting/users')}
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
                <ArrowLeft size={16} /> Back to Users
            </button>

            <PageHeader
                title={mode === 'create' ? 'New User' : `Edit ${initial?.full_name ?? initial?.email}`}
                description="Company members and their roles."
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
                {/* Avatar (edit mode — needs an existing user) */}
                {mode === 'edit' && (
                    <div className="flex items-center gap-4">
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
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={uploading}
                                onClick={() => fileRef.current?.click()}
                            >
                                {uploading ? (
                                    <Spinner size={14} className="text-current" />
                                ) : (
                                    <Upload size={14} />
                                )}
                                Change avatar
                            </Button>
                        </div>
                    </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
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
                            <p className="mt-1 text-xs text-muted-foreground">
                                Email can't be changed.
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
                            <p className="mt-1 text-xs text-muted-foreground">
                                Share this with the user; they can change it later.
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
                </div>

                {/* Roles (multi-select) */}
                <div>
                    <FieldLabel required>Roles</FieldLabel>
                    <div className="mt-1 grid gap-2 sm:grid-cols-2">
                        {roles.map((r) => {
                            const checked = roleIds.has(r.id);
                            return (
                                <button
                                    type="button"
                                    key={r.id}
                                    onClick={() => toggleRole(r.id)}
                                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                                        checked
                                            ? 'border-primary bg-primary/5 text-foreground'
                                            : 'border-border/60 text-muted-foreground hover:bg-muted/40'
                                    }`}
                                >
                                    <span
                                        className={`flex size-4 shrink-0 items-center justify-center rounded border ${
                                            checked
                                                ? 'border-primary bg-primary text-primary-foreground'
                                                : 'border-border'
                                        }`}
                                    >
                                        {checked && <Check size={12} />}
                                    </span>
                                    {r.name}
                                </button>
                            );
                        })}
                    </div>
                    {roles.length === 0 && (
                        <p className="mt-1 text-xs text-muted-foreground">
                            No roles found for this company.
                        </p>
                    )}
                </div>

                {/* Status */}
                <label className="flex items-center gap-3 border-t border-border/40 pt-4">
                    <Switch checked={isActive} onCheckedChange={setIsActive} />
                    <span className="text-sm">
                        <span className="font-medium">Active</span>
                        <span className="block text-xs text-muted-foreground">
                            Inactive users can't log in.
                        </span>
                    </span>
                </label>

                <div className="flex flex-col-reverse gap-2 border-t border-border/40 pt-4 sm:flex-row sm:justify-end">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => router.push('/setting/users')}
                    >
                        Cancel
                    </Button>
                    <Button type="submit" disabled={saving}>
                        {saving && <Spinner size={15} className="text-current" />}
                        {mode === 'create' ? 'Create User' : 'Save Changes'}
                    </Button>
                </div>
            </form>
        </div>
    );
}
