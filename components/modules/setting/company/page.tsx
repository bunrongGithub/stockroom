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
import type { TMeta } from '@/types/app';
import { Building2, Plus } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCompanyColumns } from './columns';

const DEFAULT_META: TMeta = { total: 0, page: 1, limit: 10, totalPages: 0 };

export default function CompanyModule({
    currentPath,
    permission,
    currentPathActions,
    initialData,
    initialMeta,
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
    const [companies, setCompanies] = useState<Company[]>(
        (initialData as Company[]) ?? [],
    );
    const [meta, setMeta] = useState<TMeta>(initialMeta ?? DEFAULT_META);

    // Server-side pagination: only one page is held at a time.
    const fetchPage = async (page: number, limit: number) => {
        const res = await fetch(
            `/api${currentPath.path}?page=${page}&limit=${limit}`,
        );
        if (res.ok) {
            const json = await res.json();
            setCompanies(json.data ?? []);
            setMeta(json.meta ?? DEFAULT_META);
        }
    };

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
                    pageSize={meta.limit}
                    pageSizeOptions={[10, 20, 50]}
                    serverSide={{
                        total: meta.total,
                        page: meta.page,
                        totalPages: meta.totalPages,
                        onPageChange: (p) => fetchPage(p, meta.limit),
                        onPageSizeChange: (limit) => fetchPage(1, limit),
                    }}
                />
            )}
        </div>
    );
}
