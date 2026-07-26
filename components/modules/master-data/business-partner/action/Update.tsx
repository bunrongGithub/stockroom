'use client';

import { useRegisterModule } from '@/hook/useModule';
import { businessPartnerApi } from '@/lib/api/business-partner';
import type { ModuleProps } from '@/lib/registry';
import type { BusinessPartner } from '@/types/master-data/business-partner';
import { FileWarning, Loader2Icon } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import PartnerForm, { draftFromPartner } from '../PartnerForm';

export default function BusinessPartnerUpdate({
    currentPath,
    permission,
    currentPathActions,
}: ModuleProps) {
    useRegisterModule({
        actionModules: currentPathActions,
        permission,
        modulePath: currentPath.path,
    });

    const router = useRouter();
    const params = useParams();
    const id = Number(Array.isArray(params.slug) ? params.slug.at(-2) : params.slug);

    const [partner, setPartner] = useState<BusinessPartner | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!id) return;
        businessPartnerApi
            .get(id)
            .then(setPartner)
            .catch((e) =>
                setError(e instanceof Error ? e.message : 'Failed to load partner'),
            )
            .finally(() => setLoading(false));
    }, [id]);

    if (loading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loader2Icon className="animate-spin text-emerald-500" size={26} />
            </div>
        );
    }

    if (error || !partner) {
        return (
            <div className="flex h-64 flex-col items-center justify-center gap-3">
                <FileWarning className="text-muted-foreground" size={40} />
                <p className="text-sm text-muted-foreground">
                    {error || 'Business partner not found.'}
                </p>
                <button
                    onClick={() => router.push('/master-data/business-partner')}
                    className="text-xs text-sky-600 hover:underline"
                >
                    Back to list
                </button>
            </div>
        );
    }

    return (
        <PartnerForm
            mode="edit"
            partner={partner}
            initial={draftFromPartner(partner)}
        />
    );
}
