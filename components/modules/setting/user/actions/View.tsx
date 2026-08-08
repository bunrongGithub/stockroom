'use client';

import { FieldLabel } from '@/components/ui/FieldLabel';
import { FieldGrid, SectionCard } from '@/components/ui/FormShell';
import { ReadonlyInput } from '@/components/ui/Readonly';
import { LoadingState } from '@/components/ui/Spinner';
import { Avatar } from '@/components/ui/Avatar';
import { useRegisterModule } from '@/hook/useModule';
import type { ModuleProps } from '@/lib/registry';
import { usersApi } from '@/lib/api/users';
import type { CompanyUser } from '@/service/apps/base/user/repo/user.repo';
import {
    ArrowLeft,
    Clock,
    FileWarning,
    Pencil,
    Save,
    ShieldCheck,
    UserCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const LIST_URL = '/setting/users';

function fmt(d?: string | null) {
    return d
        ? new Date(d).toLocaleString('en-GB', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
          })
        : '';
}

export default function UserView({
    currentPath,
    permission,
    currentPathActions,
}: ModuleProps) {
    useRegisterModule({
        actionModules: currentPathActions,
        permission,
        modulePath: currentPath.path,
    });

    const params = useParams();
    const router = useRouter();
    const id = String(
        Array.isArray(params.slug) ? params.slug.at(-2) : params.slug,
    );

    const [user, setUser] = useState<CompanyUser | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!id) return;
        (async () => {
            try {
                setUser(await usersApi.get(id));
            } catch (e) {
                setError(
                    e instanceof Error ? e.message : 'Failed to load user',
                );
            } finally {
                setLoading(false);
            }
        })();
    }, [id]);

    if (loading) return <LoadingState />;
    if (error || !user) {
        return (
            <div className="flex h-64 flex-col items-center justify-center gap-3 font-mono text-xs">
                <FileWarning className="text-slate-400" size={40} />
                <p className="text-slate-500">{error || 'User not found.'}</p>
                <button
                    onClick={() => router.push(LIST_URL)}
                    className="text-sky-600 hover:underline"
                >
                    Back
                </button>
            </div>
        );
    }

    const isActive = user.status === 'active';

    return (
        <div className="space-y-4 font-mono text-xs">
            {/* Header — mirrors the editor's back link, title and button pair */}
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <Link
                        href={LIST_URL}
                        className="inline-flex items-center gap-2 text-slate-500 transition-colors hover:text-slate-700"
                    >
                        <ArrowLeft size={16} /> Back
                    </Link>
                    <h2 className="mt-3 flex items-center gap-3 text-2xl font-bold text-slate-800 md:text-3xl">
                        <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                isActive
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-slate-100 text-slate-500'
                            }`}
                        >
                            {isActive ? 'Active' : 'Inactive'}
                        </span>
                    </h2>
                </div>
                <div className="flex items-center gap-2">
                    <Link
                        href={LIST_URL}
                        className="rounded-xl border border-slate-200 px-4 py-2.5 text-slate-600 transition-colors hover:bg-slate-50"
                    >
                        Back
                    </Link>
                    {permission.can_update && (
                        <Link
                            href={`${LIST_URL}/${user.id}/update`}
                            className="flex items-center justify-center gap-2 rounded-xl bg-[#1a9e52] px-4 py-2.5 font-semibold text-white transition-colors hover:bg-[#158042]"
                        >
                            <Save size={16} /> Update
                        </Link>
                    )}
                </div>
            </div>

            <SectionCard icon={<UserCircle size={13} />} title="Profile">
                <FieldGrid>
                    <div>
                        <FieldLabel>Full Name</FieldLabel>
                        <ReadonlyInput value={user.full_name ?? ''} />
                    </div>
                    <div>
                        <FieldLabel>Email</FieldLabel>
                        <ReadonlyInput value={user.email} />
                    </div>
                    <div>
                        <FieldLabel>Phone</FieldLabel>
                        <ReadonlyInput value={user.phone ?? ''} />
                    </div>
                    <div>
                        <FieldLabel>Company</FieldLabel>
                        <ReadonlyInput value={user.company_name ?? ''} />
                    </div>
                </FieldGrid>
            </SectionCard>

            <SectionCard
                icon={<ShieldCheck size={13} />}
                title={`Assigned Roles (${user.roles.length})`}
            >
                {user.roles.length ? (
                    <div className="flex flex-wrap gap-2">
                        {user.roles.map((r) => (
                            <Link
                                key={r.id}
                                href={`/setting/role/${r.id}/view`}
                                // Roles are often named in Khmer, whose
                                // subscripts sit below the Latin baseline —
                                // the extra leading keeps them off the border.
                                className="inline-flex items-center gap-1.5 rounded-xl border border-sky-200 px-3 py-2.5 font-semibold leading-relaxed text-sky-600 transition-colors hover:bg-sky-50"
                            >
                                <ShieldCheck size={13} />
                                {r.name}
                            </Link>
                        ))}
                    </div>
                ) : (
                    <p className="py-6 text-center text-slate-400">
                        No roles assigned — this user cannot reach any module.
                    </p>
                )}
            </SectionCard>

            <SectionCard icon={<Clock size={13} />} title="Activity">
                <FieldGrid>
                    <div>
                        <FieldLabel>Joined</FieldLabel>
                        <ReadonlyInput value={fmt(user.created_at)} />
                    </div>
                    <div>
                        <FieldLabel>Last Login</FieldLabel>
                        <ReadonlyInput
                            value={fmt(user.last_login_at)}
                            placeholder="Never signed in"
                        />
                    </div>
                </FieldGrid>
            </SectionCard>
        </div>
    );
}
