'use client';

import { API } from '@/lib/constant';
import { Loader2, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type RoleRow = {
    id: number;
    name: string;
    description: string | null;
    created_at?: string;
};

// Displays the company's roles and links into the existing Role module —
// role CRUD and the permission grid live at /setting/role (no duplication).
export default function RolesTab() {
    const router = useRouter();
    const [roles, setRoles] = useState<RoleRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(`${API.setting.role.root}?limit=100`);
                const body = await res.json();
                if (!res.ok) throw new Error(body.error ?? 'Failed to load roles');
                setRoles((body.data ?? []) as RoleRow[]);
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Failed to load roles');
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    if (loading) {
        return (
            <div className="flex h-40 items-center justify-center">
                <Loader2 className="animate-spin text-emerald-500" size={22} />
            </div>
        );
    }

    return (
        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Company Roles ({roles.length})
                </h3>
                <button
                    onClick={() => router.push('/setting/role')}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-sky-200 px-3 py-2 text-sky-600 hover:bg-sky-50"
                >
                    <ShieldCheck size={13} /> Manage Roles &amp; Permissions
                </button>
            </div>

            {error && (
                <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700">
                    {error}
                </div>
            )}

            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="border-b text-[10px] uppercase tracking-wider text-slate-500">
                            <th className="py-2 pr-3 text-left font-bold">Role</th>
                            <th className="py-2 pr-3 text-left font-bold">
                                Description
                            </th>
                            <th className="py-2 text-right font-bold">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {roles.map((role) => (
                            <tr key={role.id} className="border-b last:border-b-0">
                                <td className="py-2.5 pr-3">
                                    <span className="inline-block rounded-full bg-sky-100 px-2.5 py-1 text-[10px] font-semibold text-sky-800">
                                        {role.name}
                                    </span>
                                </td>
                                <td className="py-2.5 pr-3 text-slate-500">
                                    {role.description || '—'}
                                </td>
                                <td className="py-2.5 text-right">
                                    <button
                                        onClick={() =>
                                            router.push(
                                                `/setting/role/${role.id}/view`,
                                            )
                                        }
                                        className="rounded-lg border px-2.5 py-1.5 hover:bg-muted"
                                    >
                                        View Permissions
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {!roles.length && (
                            <tr>
                                <td
                                    colSpan={3}
                                    className="py-8 text-center text-slate-400"
                                >
                                    No roles yet.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
