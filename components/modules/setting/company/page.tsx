'use client';

import { ButtonActionStaticRender } from '@/components/ui/button-action';
import { DataTable, type DataTableFilterDef } from '@/components/ui/DataTable';
import { PageHeader } from '@/components/ui/PageHeader';
import { useRegisterModule } from '@/hook/useModule';
import { usePageActions } from '@/hook/usePageAction';
import { useTableQuery } from '@/hook/useTableQuery';
import type { ModuleProps } from '@/lib/registry';
import { API } from '@/lib/constant';
import type { Company } from '@/types/setting/company';
import { getCompanyColumns } from './columns';

const FILTER_DEFS: DataTableFilterDef[] = [
    {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: [
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
        ],
    },
    { key: 'created_at', label: 'Created', type: 'date-range' },
];

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

    const table = useTableQuery<Company>({
        endpoint: API.setting.company.root,
        initialData: initialData as Company[] | undefined,
        initialMeta,
    });

    return (
        <div className="space-y-4 font-mono">
            <PageHeader
                title="Companies"
                description="Manage the companies registered in the system."
                actions={staticActions.map((action) => (
                    <span key={action.href}>{ButtonActionStaticRender(action)}</span>
                ))}
            />

            <DataTable<Company>
                columns={getCompanyColumns({ dynamicActions })}
                data={table.data}
                keyExtractor={(c) => c.id}
                mobileVariant="cards"
                minTableWidth="1020px"
                searchPlaceholder="Search by name, email, or registration no..."
                pageSizeOptions={[10, 20, 50]}
                serverQuery={table.binding}
                filterDefs={FILTER_DEFS}
                enableColumnVisibility
                emptyTitle="No companies yet"
                emptyDescription="Create the first company to get started."
            />
        </div>
    );
}
