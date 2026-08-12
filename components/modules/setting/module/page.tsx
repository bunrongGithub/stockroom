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
import type { AppModule } from '@/types/app';
import { useState } from 'react';
import { getModuleColumns } from './columns';

const FILTER_DEFS: DataTableFilterDef[] = [
    {
        key: 'type',
        label: 'Type',
        type: 'select',
        options: [
            { value: 'transaction', label: 'Transaction' },
            { value: 'configuration', label: 'Configuration' },
        ],
    },
    {
        key: 'is_active',
        label: 'Status',
        type: 'select',
        options: [
            { value: 'true', label: 'Active' },
            { value: 'false', label: 'Inactive' },
        ],
    },
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
    const [deleting, setDeleting] = useState<AppModule | null>(null);

    const table = useTableQuery<AppModule>({
        endpoint: API.setting.module.root,
        initialData: initialData as AppModule[] | undefined,
        initialMeta,
    });

    async function handleDelete() {
        if (!deleting) return;
        try {
            const res = await fetch(
                `${API.setting.module.root}/${deleting.id}`,
                { method: 'DELETE' },
            );
            if (!res.ok) throw new Error('Delete failed');
            toast.success(`Module "${deleting.label}" deleted.`);
            await table.refresh();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Failed to delete module');
            throw e; // keep the dialog open on failure
        } finally {
            setDeleting(null);
        }
    }

    return (
        <div className="space-y-4 font-mono">
            <PageHeader
                title="Modules"
                description="The catalog that drives navigation, routing, and permissions."
                actions={staticActions.map((action) => (
                    <span key={action.href}>
                        {ButtonActionStaticRender(action, false)}
                    </span>
                ))}
            />

            <ConfirmDialog
                open={deleting !== null}
                onOpenChange={(o) => !o && setDeleting(null)}
                title="Delete Module"
                description={`Delete "${deleting?.label}"? Its permissions and any child rows go with it.`}
                confirmLabel="Delete"
                tone="danger"
                onConfirm={handleDelete}
            />

            <DataTable<AppModule>
                columns={getModuleColumns({
                    dynamicActions,
                    onDelete: (id: number) => {
                        const row = table.data.find((m) => m.id === id);
                        if (row) setDeleting(row);
                    },
                })}
                data={table.data}
                keyExtractor={(row) => row.id}
                mobileVariant="cards"
                minTableWidth="1160px"
                searchPlaceholder="Search by key, label, or path..."
                pageSizeOptions={[10, 20, 50]}
                serverQuery={table.binding}
                filterDefs={FILTER_DEFS}
                enableColumnVisibility
                emptyTitle="No modules found"
                emptyDescription="No modules match your search criteria"
            />
        </div>
    );
}
