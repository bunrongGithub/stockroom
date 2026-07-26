'use client';

import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LoadingState } from '@/components/ui/Spinner';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/button';
import { useRegisterModule } from '@/hook/useModule';
import type { ModuleProps } from '@/lib/registry';
import { usersApi } from '@/lib/api/users';
import type { CompanyUser } from '@/service/apps/base/user/repo/user.repo';
import { ArrowLeft, Edit2, Users, FileWarning } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

function Field({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground">{label}</p>
            <div className="text-sm text-foreground">{value || '—'}</div>
        </div>
    );
}

function fmt(d?: string | null) {
    return d
        ? new Date(d).toLocaleString('en-GB', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
          })
        : '—';
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
                setError(e instanceof Error ? e.message : 'Failed to load user');
            } finally {
                setLoading(false);
            }
        })();
    }, [id]);

    if (loading) return <LoadingState />;
    if (error || !user) {
        return (
            <div className="flex h-64 flex-col items-center justify-center gap-3">
                <FileWarning className="text-muted-foreground" size={40} />
                <p className="text-sm text-muted-foreground">
                    {error || 'User not found.'}
                </p>
                <button
                    onClick={() => router.push('/setting/users')}
                    className="text-xs text-primary hover:underline"
                >
                    Back to Users
                </button>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-3xl space-y-4">
            <button
                type="button"
                onClick={() => router.push('/setting/users')}
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
                <ArrowLeft size={16} /> Back to Users
            </button>

            <PageHeader
                title={
                    <span className="inline-flex items-center gap-3">
                        <Avatar
                            src={user.avatar_url}
                            name={user.full_name ?? user.email}
                            size={40}
                        />
                        {user.full_name ?? user.email}
                    </span>
                }
                description={user.email}
                actions={
                    permission.can_update && (
                        <Button
                            onClick={() =>
                                router.push(`/setting/users/${user.id}/update`)
                            }
                        >
                            <Edit2 size={15} /> Edit
                        </Button>
                    )
                }
            />

            {/* Profile */}
            <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
                <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Profile
                </h3>
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
                    <Field label="Full Name" value={user.full_name} />
                    <Field label="Email" value={user.email} />
                    <Field label="Phone" value={user.phone} />
                    <Field label="Company" value={user.company_name} />
                    <Field
                        label="Status"
                        value={
                            <StatusBadge
                                status={
                                    user.status === 'active' ? 'ACTIVE' : 'INACTIVE'
                                }
                            />
                        }
                    />
                </div>
            </section>

            {/* Roles */}
            <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
                <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Assigned Roles ({user.roles.length})
                </h3>
                {user.roles.length ? (
                    <div className="flex flex-wrap gap-2">
                        {user.roles.map((r) => (
                            <span
                                key={r.id}
                                className="rounded-full bg-info-muted px-3 py-1 text-sm text-info"
                            >
                                {r.name}
                            </span>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground">
                        No roles assigned.
                    </p>
                )}
            </section>

            {/* Activity */}
            <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
                <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Activity
                </h3>
                <div className="grid grid-cols-2 gap-4">
                    <Field label="Joined" value={fmt(user.created_at)} />
                    <Field label="Last Login" value={fmt(user.last_login_at)} />
                </div>
            </section>
        </div>
    );
}
