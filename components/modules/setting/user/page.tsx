'use client';

import { ButtonActionStaticRender } from '@/components/ui/button-action';
import { DataTable, type DataTableFilterDef } from '@/components/ui/DataTable';
import { PageHeader } from '@/components/ui/PageHeader';
import { useToast } from '@/components/ui/Toast';
import { useRegisterModule } from '@/hook/useModule';
import { usePageActions } from '@/hook/usePageAction';
import { useTableQuery } from '@/hook/useTableQuery';
import type { ModuleProps } from '@/lib/registry';
import { API } from '@/lib/constant';
import { usersApi } from '@/lib/api/users';
import type { CompanyUser } from '@/service/apps/base/user/repo/user.repo';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { getUserColumns } from './columns';

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
    { key: 'created_at', label: 'Joined', type: 'date-range' },
];

export default function UserModule({
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

    const toast = useToast();
    const [confirm, setConfirm] = useState<CompanyUser | null>(null);

    const table = useTableQuery<CompanyUser>({
        endpoint: API.setting.users.root,
        initialData: initialData as CompanyUser[] | undefined,
        initialMeta,
    });

    async function handleDeactivate() {
        if (!confirm) return;
        try {
            await usersApi.setStatus(String(confirm.id), 'inactive');
            toast.success(`${confirm.full_name ?? confirm.email} deactivated.`);
            await table.refresh();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Could not deactivate user');
            throw e;
        } finally {
            setConfirm(null);
        }
    }

    return (
        <div className="space-y-4 font-mono">
            <PageHeader
                title="Users"
                description="Manage the people who belong to your company."
                actions={staticActions.map((action) => (
                    <span key={action.href}>{ButtonActionStaticRender(action)}</span>
                ))}
            />

            <ConfirmDialog
                open={confirm !== null}
                onOpenChange={(o) => !o && setConfirm(null)}
                title={`Deactivate ${confirm?.full_name ?? confirm?.email}?`}
                description="The user will be blocked from logging in until reactivated. Their history is preserved."
                confirmLabel="Deactivate"
                tone="danger"
                onConfirm={handleDeactivate}
            />

            <DataTable<CompanyUser>
                columns={getUserColumns({
                    dynamicActions,
                    onDelete: (id: number) => {
                        const user = table.data.find((u) => Number(u.id) === id);
                        if (user) setConfirm(user);
                    },
                })}
                data={table.data}
                keyExtractor={(u) => u.id}
                mobileVariant="cards"
                minTableWidth="960px"
                searchPlaceholder="Search by name, email, or phone..."
                pageSizeOptions={[10, 20, 50]}
                serverQuery={table.binding}
                filterDefs={FILTER_DEFS}
                enableColumnVisibility
                emptyTitle="No users yet"
                emptyDescription="Add your team by creating their accounts."
            />
        </div>
    );
}
