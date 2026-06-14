'use client';

import type { DataTableColumn } from '@/components/ui/DataTable';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/badge';
import { useRegisterModule } from '@/hook/useModule';
import type { ModuleProps } from '@/lib/registry';
import { Users } from 'lucide-react';
import { useEffect, useState } from 'react';

type UserRow = {
    id: string;
    email: string;
    full_name: string | null;
    company_id: number | null;
    roles: string[];
    created_at: string;
};

const ROLE_COLORS: Record<string, string> = {
    super_admin: 'bg-purple-100 text-purple-700 border-purple-200',
    admin: 'bg-rose-100 text-rose-700 border-rose-200',
    staff: 'bg-sky-100 text-sky-700 border-sky-200',
    member: 'bg-slate-100 text-slate-600 border-slate-200',
};

const COLUMNS: DataTableColumn<UserRow>[] = [
    {
        key: 'user',
        header: 'User',
        cell: (row) => (
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold shrink-0">
                    {row.email.substring(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">
                        {row.email}
                    </p>
                    {row.full_name && (
                        <p className="text-xs text-slate-400 truncate">
                            {row.full_name}
                        </p>
                    )}
                </div>
            </div>
        ),
    },
    {
        key: 'roles',
        header: 'Roles',
        cell: (row) =>
            row.roles.length === 0 ? (
                <span className="text-xs text-muted-foreground italic">
                    No role
                </span>
            ) : (
                <div className="flex gap-1 flex-wrap">
                    {row.roles.map((r) => (
                        <span
                            key={r}
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${ROLE_COLORS[r] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}
                        >
                            {r}
                        </span>
                    ))}
                </div>
            ),
    },
    {
        key: 'joined',
        header: 'Joined',
        headerClassName: 'text-right',
        cellClassName: 'text-right',
        cell: (row) => (
            <span className="text-xs text-muted-foreground">
                {new Date(row.created_at).toLocaleDateString()}
            </span>
        ),
    },
];

export default function User({
    currentPath,
    permission,
    currentPathActions,
}: ModuleProps) {
    useRegisterModule({
        actionModules: currentPathActions,
        permission,
        modulePath: currentPath.path,
    });
    const [users, setUsers] = useState<UserRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetch('/api/setting/users')
            .then((r) => r.json())
            .then((d) => {
                if (d.error) setError(d.error);
                else setUsers(d.data ?? []);
            })
            .catch((e) => setError(String(e)))
            .finally(() => setLoading(false));
    }, []);

    return (
        <div className=" mx-auto animate-in fade-in duration-300">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                    <Users size={20} className="text-emerald-600" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-slate-800">Users</h2>
                    <p className="text-sm text-slate-500">
                        All registered system users and their roles
                    </p>
                </div>
                {!loading && (
                    <Badge variant="secondary" className="ml-auto">
                        {users.length} user{users.length !== 1 ? 's' : ''}
                    </Badge>
                )}
            </div>

            {error && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">
                    {error}
                </div>
            )}

            {loading ? (
                <div className="flex justify-center py-16">
                    <div className="w-6 h-6 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
                </div>
            ) : (
                <DataTable
                    columns={COLUMNS}
                    data={users}
                    keyExtractor={(r) => r.id}
                    searchFn={(row, q) =>
                        row.email.toLowerCase().includes(q) ||
                        (row.full_name ?? '').toLowerCase().includes(q)
                    }
                    searchPlaceholder="Search by email or name..."
                    emptyTitle="No users found"
                    emptyDescription="Users appear here after they sign up"
                />
            )}
        </div>
    );
}
