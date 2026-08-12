'use client';

import { ButtonActionStaticRender } from '@/components/ui/button-action';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DataTable, type DataTableFilterDef } from '@/components/ui/DataTable';
import { PageHeader } from '@/components/ui/PageHeader';
import { useToast } from '@/components/ui/Toast';
import { useRegisterModule } from '@/hook/useModule';
import { usePageActions } from '@/hook/usePageAction';
import { useTableQuery } from '@/hook/useTableQuery';
import type { ModuleProps } from '@/lib/registry';
import { API } from '@/lib/constant';
import { useState } from 'react';
import { getRoleColumns, TRole } from './columns';

const FILTER_DEFS: DataTableFilterDef[] = [
    {
        key: 'is_active',
        label: 'Status',
        type: 'select',
        options: [
            { value: 'true', label: 'Active' },
            { value: 'false', label: 'Inactive' },
        ],
    },
    { key: 'created_at', label: 'Created', type: 'date-range' },
];

export default function Page({
    currentPath,
    permission,
    initialData,
    initialMeta,
    currentPathActions,
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
    const [deleting, setDeleting] = useState<TRole | null>(null);

    const table = useTableQuery<TRole>({
        endpoint: API.setting.role.root,
        initialData: initialData as TRole[] | undefined,
        initialMeta,
    });

    async function handleDelete() {
        if (!deleting) return;
        try {
            const res = await fetch(`${API.setting.role.root}/${deleting.id}`, {
                method: 'DELETE',
            });
            if (!res.ok) throw new Error('Delete failed');
            toast.success(`Role "${deleting.name}" deleted.`);
            await table.refresh();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Delete failed');
            throw e; // keep the dialog open on failure
        } finally {
            setDeleting(null);
        }
    }

    return (
        <div className="space-y-4 font-mono">
            <PageHeader
                title="Roles"
                description="Define what each group of users is allowed to do."
                actions={staticActions.map((action) => (
                    <span key={action.href}>
                        {ButtonActionStaticRender(action, false)}
                    </span>
                ))}
            />

            <ConfirmDialog
                open={deleting !== null}
                onOpenChange={(o) => !o && setDeleting(null)}
                title="Delete Role"
                description={`Delete "${deleting?.name}"? Users holding this role lose its permissions.`}
                confirmLabel="Delete"
                tone="danger"
                onConfirm={handleDelete}
            />

            <DataTable<TRole>
                columns={getRoleColumns({
                    dynamicActions,
                    onDelete: (id: number) => {
                        const role = table.data.find((r) => r.id === id);
                        if (role) setDeleting(role);
                    },
                })}
                data={table.data}
                keyExtractor={(r) => r.id}
                mobileVariant="cards"
                minTableWidth="1120px"
                searchPlaceholder="Search by name or description..."
                pageSizeOptions={[10, 20, 50]}
                serverQuery={table.binding}
                filterDefs={FILTER_DEFS}
                enableColumnVisibility
                emptyTitle="No roles yet"
                emptyDescription="Create your first role to get started"
            />
        </div>
    );
}
