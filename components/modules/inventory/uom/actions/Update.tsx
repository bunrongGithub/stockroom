'use client';

import { useRegisterModule } from '@/hook/useModule';
import type { ModuleProps } from '@/lib/registry';
import { uomApi } from '@/lib/api/uom';
import type { InventoryUom } from '@/service/apps/inventory/repo/uom';
import UomForm from '../UomForm';
import { LoadingState } from '@/components/ui/Spinner';
import { FileWarning } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function InventoryUomUpdate({
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

    const [uom, setUom] = useState<InventoryUom | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!id) return;
        (async () => {
            try {
                setUom((await uomApi.get(id)).data);
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Failed to load unit');
            } finally {
                setLoading(false);
            }
        })();
    }, [id]);

    if (loading) return <LoadingState />;
    if (error || !uom) {
        return (
            <div className="flex h-64 flex-col items-center justify-center gap-3">
                <FileWarning className="text-muted-foreground" size={40} />
                <p className="text-sm text-muted-foreground">
                    {error || 'Unit not found.'}
                </p>
                <button
                    onClick={() => router.push('/inventory/configurations/uom')}
                    className="text-xs text-primary hover:underline"
                >
                    Back
                </button>
            </div>
        );
    }

    return <UomForm mode="edit" initial={uom} />;
}
