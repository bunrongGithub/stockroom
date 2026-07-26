'use client';

import { FormModal } from '@/components/ui/FormModal';
import { useApp } from '@/context/AppContext';
import { companyApi } from '@/lib/api/company';
import { API } from '@/lib/constant';
import type { CompanyUser } from '@/types/setting/company';
import { Loader2, ShieldCheck, Trash2, UserIcon } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

type RoleOption = { id: number; name: string; description?: string | null };

function Avatar({ user }: { user: CompanyUser }) {
    if (user.avatar_url) {
        // eslint-disable-next-line @next/next/no-img-element
        return (
            <img
                src={user.avatar_url}
                alt={user.full_name ?? user.email}
                className="h-8 w-8 rounded-full border border-slate-200 object-cover"
            />
        );
    }
    const initials = (user.full_name || user.email)
        .split(/[\s@]+/)
        .slice(0, 2)
        .map((p) => p.charAt(0).toUpperCase())
        .join('');
    return (
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-700">
            {initials || <UserIcon size={13} />}
        </span>
    );
}

export default function UsersTab({
    companyId,
    canManage,
    onToast,
}: {
    companyId?: number;
    canManage: boolean;
    onToast: (message: string) => void;
}) {
    const { profile } = useApp();
    const [users, setUsers] = useState<CompanyUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Assign-role modal
    const [assignTarget, setAssignTarget] = useState<CompanyUser | null>(null);
    const [roles, setRoles] = useState<RoleOption[]>([]);
    const [selectedRole, setSelectedRole] = useState<number | ''>('');
    const [saving, setSaving] = useState(false);
    const [modalError, setModalError] = useState('');

    // Remove confirmation
    const [removeTarget, setRemoveTarget] = useState<CompanyUser | null>(null);

    const load = useCallback(async () => {
        try {
            const res = await companyApi.listUsers(1, 100, companyId);
            setUsers(res.data ?? []);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load users');
        } finally {
            setLoading(false);
        }
    }, [companyId]);

    useEffect(() => {
        load();
    }, [load]);

    async function openAssign(user: CompanyUser) {
        setAssignTarget(user);
        setModalError('');
        setSelectedRole(user.roles?.[0]?.id ?? '');
        if (!roles.length) {
            try {
                const res = await fetch(`${API.setting.role.root}?limit=100`);
                const body = await res.json();
                setRoles(
                    ((body.data ?? []) as RoleOption[]).map((r) => ({
                        id: r.id,
                        name: r.name,
                    })),
                );
            } catch {
                setModalError('Failed to load roles');
            }
        }
    }

    async function submitAssign() {
        if (!assignTarget || !selectedRole) return;
        setSaving(true);
        setModalError('');
        try {
            await companyApi.assignRole(assignTarget.id, Number(selectedRole));
            setAssignTarget(null);
            onToast('Role assigned');
            await load();
        } catch (e) {
            setModalError(
                e instanceof Error ? e.message : 'Failed to assign role',
            );
        } finally {
            setSaving(false);
        }
    }

    async function submitRemove() {
        if (!removeTarget) return;
        setSaving(true);
        setModalError('');
        try {
            await companyApi.removeUser(removeTarget.id);
            setRemoveTarget(null);
            onToast('User removed from company');
            await load();
        } catch (e) {
            setModalError(
                e instanceof Error ? e.message : 'Failed to remove user',
            );
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return (
            <div className="flex h-40 items-center justify-center">
                <Loader2 className="animate-spin text-emerald-500" size={22} />
            </div>
        );
    }

    return (
        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                Company Users ({users.length})
            </h3>

            {error && (
                <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700">
                    {error}
                </div>
            )}

            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="border-b text-[10px] uppercase tracking-wider text-slate-500">
                            <th className="py-2 pr-3 text-left font-bold">User</th>
                            <th className="py-2 pr-3 text-left font-bold">Email</th>
                            <th className="py-2 pr-3 text-left font-bold">Role</th>
                            <th className="py-2 pr-3 text-left font-bold">Status</th>
                            <th className="py-2 pr-3 text-left font-bold">Last Login</th>
                            <th className="py-2 pr-3 text-left font-bold">Joined</th>
                            {canManage && (
                                <th className="py-2 text-right font-bold">Actions</th>
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {users.map((user) => {
                            const isSelf = user.id === profile?.userId;
                            return (
                                <tr key={user.id} className="border-b last:border-b-0">
                                    <td className="py-2.5 pr-3">
                                        <div className="flex items-center gap-2.5">
                                            <Avatar user={user} />
                                            <span className="font-medium text-slate-800">
                                                {user.full_name || '—'}
                                                {isSelf && (
                                                    <span className="ml-1.5 text-[10px] text-slate-400">
                                                        (you)
                                                    </span>
                                                )}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="py-2.5 pr-3">{user.email}</td>
                                    <td className="py-2.5 pr-3">
                                        {user.roles?.length ? (
                                            user.roles.map((r) => (
                                                <span
                                                    key={r.id}
                                                    className="mr-1 inline-block rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium text-sky-800"
                                                >
                                                    {r.name}
                                                </span>
                                            ))
                                        ) : (
                                            <span className="text-slate-400">—</span>
                                        )}
                                    </td>
                                    <td className="py-2.5 pr-3">
                                        <span
                                            className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${
                                                user.status === 'active'
                                                    ? 'bg-emerald-100 text-emerald-800'
                                                    : 'bg-gray-100 text-gray-600'
                                            }`}
                                        >
                                            {user.status}
                                        </span>
                                    </td>
                                    <td className="py-2.5 pr-3 text-slate-500">
                                        {user.last_login_at
                                            ? new Date(
                                                  user.last_login_at,
                                              ).toLocaleString()
                                            : '—'}
                                    </td>
                                    <td className="py-2.5 pr-3 text-slate-500">
                                        {new Date(
                                            user.created_at,
                                        ).toLocaleDateString()}
                                    </td>
                                    {canManage && (
                                        <td className="py-2.5 text-right">
                                            <div className="flex justify-end gap-1.5">
                                                <button
                                                    onClick={() => openAssign(user)}
                                                    title="Assign role"
                                                    className="inline-flex items-center gap-1 rounded-lg border border-sky-200 px-2.5 py-1.5 text-sky-600 hover:bg-sky-50"
                                                >
                                                    <ShieldCheck size={12} /> Role
                                                </button>
                                                <button
                                                    onClick={() =>
                                                        setRemoveTarget(user)
                                                    }
                                                    disabled={isSelf}
                                                    title={
                                                        isSelf
                                                            ? 'You cannot remove yourself'
                                                            : 'Remove from company'
                                                    }
                                                    className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1.5 text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            );
                        })}
                        {!users.length && (
                            <tr>
                                <td
                                    colSpan={canManage ? 7 : 6}
                                    className="py-8 text-center text-slate-400"
                                >
                                    No users in this company yet.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Assign role modal */}
            <FormModal
                open={!!assignTarget}
                onOpenChange={(open) => !open && setAssignTarget(null)}
                title="Assign Role"
                description={`Set the role for ${assignTarget?.full_name || assignTarget?.email || ''} in this company.`}
                onSubmit={submitAssign}
                submitLabel="Assign"
                submitting={saving}
                submitDisabled={!selectedRole}
            >
                {modalError && (
                    <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                        {modalError}
                    </div>
                )}
                <select
                    value={selectedRole}
                    onChange={(e) =>
                        setSelectedRole(
                            e.target.value ? Number(e.target.value) : '',
                        )
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none"
                >
                    <option value="">Select a role…</option>
                    {roles.map((role) => (
                        <option key={role.id} value={role.id}>
                            {role.name}
                        </option>
                    ))}
                </select>
                <p className="mt-2 text-[10px] text-slate-400">
                    The user must sign in again for the new role to take effect.
                </p>
            </FormModal>

            {/* Remove confirmation */}
            <FormModal
                open={!!removeTarget}
                onOpenChange={(open) => !open && setRemoveTarget(null)}
                title="Remove User"
                description={`Remove ${removeTarget?.full_name || removeTarget?.email || ''} from this company? Their documents are kept, but they lose all access.`}
                onSubmit={submitRemove}
                submitLabel="Remove"
                submitting={saving}
            >
                {modalError && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                        {modalError}
                    </div>
                )}
            </FormModal>
        </section>
    );
}
