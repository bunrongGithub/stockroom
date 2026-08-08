'use client';

import { useRegisterModule } from '@/hook/useModule';
import type { ModuleProps } from '@/lib/registry';
import { companyApi } from '@/lib/api/company';
import type { Company } from '@/types/setting/company';
import CompanyDetail from '../CompanyDetail';
import { LoadingState } from '@/components/ui/Spinner';
import { FileWarning } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function CompanyView({
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
    const id = Number(
        Array.isArray(params.slug) ? params.slug.at(-2) : params.slug,
    );

    const [company, setCompany] = useState<Company | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!id) return;
        (async () => {
            try {
                setCompany(await companyApi.get(id));
            } catch (e) {
                setError(
                    e instanceof Error ? e.message : 'Failed to load company',
                );
            } finally {
                setLoading(false);
            }
        })();
    }, [id]);

    if (loading) return <LoadingState />;
    if (error || !company) {
        return (
            <div className="flex h-64 flex-col items-center justify-center gap-3">
                <FileWarning className="text-muted-foreground" size={40} />
                <p className="text-sm text-muted-foreground">
                    {error || 'Company not found.'}
                </p>
                <button
                    onClick={() => router.push('/setting/company')}
                    className="text-xs text-primary hover:underline"
                >
                    Back
                </button>
            </div>
        );
    }

    return (
        <CompanyDetail
            initial={company}
            canUpdate={!!permission?.can_update}
        />
    );
}
