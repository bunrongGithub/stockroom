'use client';

import { Button } from '@/components/ui/button';
import { ButtonActionStaticRender } from '@/components/ui/button-action';
import { DataTable } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { useRegisterModule } from '@/hook/useModule';
import { usePageActions } from '@/hook/usePageAction';
import type { ModuleProps } from '@/lib/registry';
import type { Company } from '@/types/setting/company';
import { Building2, Plus } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCompanyColumns } from './columns';

export default function CompanyModule({
    currentPath,
    permission,
    currentPathActions,
    initialData,
}: ModuleProps) {
    useRegisterModule({
        actionModules: currentPathActions,
        permission,
        modulePath: currentPath.path,
    });

    const pageAction = usePageActions();
    const staticActions = pageAction?.actions.filter((a) => !a.dynamic) ?? [];
    const dynamicActions = pageAction?.actions.filter((a) => a.dynamic) ?? [];

    const router = useRouter();
    const [companies] = useState<Company[]>((initialData as Company[]) ?? []);

    return (
        <div className="space-y-4">
            <PageHeader
                title="Companies"
                description="Manage the companies registered in the system."
                actions={
                    staticActions.map((action) => (
                        <span key={action.href}>
                            {ButtonActionStaticRender(action)}
                        </span>
                    ))[0]
                }
            />

            {companies.length === 0 ? (
                <EmptyState
                    icon={Building2}
                    title="No companies yet"
                    description="Create the first company to get started."
                    action={
                        permission.can_create ? (
                            <Button
                                size="sm"
                                className="gap-1.5 bg-emerald-600 hover:bg-emerald-500"
                                onClick={() =>
                                    router.push('/setting/company/create')
                                }
                            >
                                <Plus size={14} /> Add Company
                            </Button>
                        ) : undefined
                    }
                />
            ) : (
                <DataTable
                    columns={getCompanyColumns({ dynamicActions })}
                    data={companies}
                    keyExtractor={(c) => c.id}
                    searchFn={(row, q) =>
                        row.name.toLowerCase().includes(q) ||
                        (row.email ?? '').toLowerCase().includes(q) ||
                        (row.registration_number ?? '')
                            .toLowerCase()
                            .includes(q) ||
                        row.status.toLowerCase().includes(q)
                    }
                    searchPlaceholder="Search by name, email, or status..."
                />
            )}
        </div>
    );
}
