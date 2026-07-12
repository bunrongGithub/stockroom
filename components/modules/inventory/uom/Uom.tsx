'use client';

import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/Toast';
import { useRegisterModule } from '@/hook/useModule';
import type { ModuleProps } from '@/lib/registry';
import type { InventoryUom } from '@/service/apps/inventory/repo/uom';
import { uomApi } from '@/lib/api/uom';
import {
    Edit2,
    Eye,
    Plus,
    Ruler,
    Star,
    Power,
    Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Confirm =
    | { kind: 'delete'; row: InventoryUom }
    | { kind: 'deactivate'; row: InventoryUom }
    | null;

export default function InventoryUomListModule({
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

    const router = useRouter();
    const toast = useToast();
    const [items, setItems] = useState<InventoryUom[]>(
        (initialData as InventoryUom[] | null) ?? [],
    );
    const [confirm, setConfirm] = useState<Confirm>(null);

    async function refreshUoms() {
        try {
            setItems(await uomApi.list({ sortBy: 'name' }));
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Failed to load units');
        }
    }

    async function setDefault(row: InventoryUom) {
        try {
            await uomApi.setDefault(row.id);
            toast.success(`${row.code} is now the default unit.`);
            await refreshUoms();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Could not set default');
        }
    }

    async function setActive(row: InventoryUom, active: boolean) {
        try {
            await uomApi.setActive(row.id, active);
            toast.success(`${row.code} ${active ? 'activated' : 'deactivated'}.`);
            await refreshUoms();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Could not update status');
        }
    }

    async function runConfirm() {
        if (!confirm) return;
        try {
            if (confirm.kind === 'delete') {
                await uomApi.remove(confirm.row.id);
                toast.success(`${confirm.row.code} deleted.`);
            } else {
                await uomApi.setActive(confirm.row.id, false);
                toast.success(`${confirm.row.code} deactivated.`);
            }
            await refreshUoms();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Action failed');
            throw e; // keep dialog open on failure
        }
    }

    const columns: DataTableColumn<InventoryUom>[] = [
        {
            key: 'code',
            header: 'Code',
            primary: true,
            cell: (row) => (
                <button
                    onClick={() =>
                        router.push(`/inventory/configurations/uom/${row.id}/view`)
                    }
                    className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
                >
                    {row.code}
                    {row.is_default && (
                        <Star className="size-3.5 fill-warning text-warning" />
                    )}
                </button>
            ),
        },
        { key: 'name', header: 'Name', cell: (row) => row.name },
        {
            key: 'display_name',
            header: 'Symbol',
            cell: (row) => (
                <span className="font-mono text-xs text-muted-foreground">
                    {row.display_name}
                </span>
            ),
        },
        {
            key: 'status',
            header: 'Status',
            cell: (row) => (
                <StatusBadge status={row.is_active ? 'ACTIVE' : 'INACTIVE'} />
            ),
        },
        {
            key: 'usage',
            header: 'Usage',
            align: 'right',
            cell: (row) => (
                <span className="tabular-nums text-muted-foreground">
                    {row.item_count ?? 0} item{(row.item_count ?? 0) === 1 ? '' : 's'}
                </span>
            ),
        },
        {
            key: 'actions',
            header: 'Actions',
            align: 'right',
            cardFooter: true,
            cell: (row) => (
                <div className="flex flex-wrap items-center justify-end gap-1.5">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                            router.push(
                                `/inventory/configurations/uom/${row.id}/view`,
                            )
                        }
                    >
                        <Eye size={14} /> View
                    </Button>
                    {permission.can_update && (
                        <>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                    router.push(
                                        `/inventory/configurations/uom/${row.id}/update`,
                                    )
                                }
                            >
                                <Edit2 size={14} /> Edit
                            </Button>
                            {!row.is_default && row.is_active && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setDefault(row)}
                                >
                                    <Star size={14} /> Set Default
                                </Button>
                            )}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                    row.is_active
                                        ? setConfirm({ kind: 'deactivate', row })
                                        : setActive(row, true)
                                }
                            >
                                <Power size={14} />{' '}
                                {row.is_active ? 'Deactivate' : 'Activate'}
                            </Button>
                        </>
                    )}
                    {permission.can_delete && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="text-danger hover:text-danger"
                            onClick={() => setConfirm({ kind: 'delete', row })}
                        >
                            <Trash2 size={14} /> Delete
                        </Button>
                    )}
                </div>
            ),
        },
    ];

    return (
        <div className="space-y-4">
            <PageHeader
                title="Units of Measure"
                description="Master list of units used across inventory and transactions."
                actions={
                    permission.can_create && (
                        <Button
                            onClick={() =>
                                router.push('/inventory/configurations/uom/create')
                            }
                        >
                            <Plus size={16} /> New UOM
                        </Button>
                    )
                }
            />

            <DataTable<InventoryUom>
                columns={columns}
                data={items}
                keyExtractor={(row) => row.id}
                mobileVariant="cards"
                minTableWidth="820px"
                searchFn={(row, q) =>
                    row.code.toLowerCase().includes(q) ||
                    row.name.toLowerCase().includes(q) ||
                    row.display_name.toLowerCase().includes(q) ||
                    (row.description ?? '').toLowerCase().includes(q)
                }
                searchPlaceholder="Search by code, name, or description..."
                emptyIcon={<Ruler className="size-8" />}
                emptyTitle="No units of measure"
                emptyDescription="Create a UOM like Piece (PCS) or Kilogram (KG) to get started."
            />

            <ConfirmDialog
                open={confirm !== null}
                onOpenChange={(o) => !o && setConfirm(null)}
                title={
                    confirm?.kind === 'delete'
                        ? `Delete ${confirm?.row.code}?`
                        : `Deactivate ${confirm?.row.code}?`
                }
                description={
                    confirm?.kind === 'delete'
                        ? 'This permanently removes the unit. Units used by items or transactions cannot be deleted — deactivate them instead.'
                        : 'Inactive units stay on historical records but cannot be chosen on new transactions.'
                }
                confirmLabel={confirm?.kind === 'delete' ? 'Delete' : 'Deactivate'}
                tone="danger"
                onConfirm={runConfirm}
            />
        </div>
    );
}
