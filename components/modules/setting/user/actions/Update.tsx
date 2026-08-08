'use client';

import { useRegisterModule } from '@/hook/useModule';
import type { ModuleProps } from '@/lib/registry';
import { usersApi } from '@/lib/api/users';
import type { CompanyUser } from '@/service/apps/base/user/repo/user.repo';
import UserForm from '../UserForm';
import { LoadingState } from '@/components/ui/Spinner';
import { FileWarning } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function UserUpdate({
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
                    Back
                </button>
            </div>
        );
    }

    return <UserForm mode="edit" initial={user} />;
}
