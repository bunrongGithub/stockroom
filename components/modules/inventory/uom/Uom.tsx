'use client';

import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/button';
import { useRegisterModule } from '@/hook/useModule';
import type { ModuleProps } from '@/lib/registry';
import type { InventoryUom } from '@/service/apps/inventory/repo/uom';
import { Edit2, Eye, Plus, Ruler } from 'lucide-react';
import Link from 'next/link';

const columns: DataTableColumn<InventoryUom>[] = [
    {
        key: 'name',
        header: 'Name',
        cell: (row) => (
            <div>
                <p className="text-sm font-semibold text-slate-800">{row.name}</p>
            </div>
        ),
    },
    {
        key: 'display_name',
        header: 'Abbreviation',
        cell: (row) => (
            <span className="inline-flex items-center rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 border border-emerald-200">
                {row.display_name}
            </span>
        ),
    },
    {
        key: 'created_at',
        header: 'Created',
        cell: (row) => (
            <span className="text-xs text-slate-400">
                {new Date(row.created_at).toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                })}
            </span>
        ),
    },
    {
        key: 'actions',
        header: '',
        headerClassName: 'w-0',
        cell: (row) => (
            <div className="flex items-center justify-end gap-1">
                <Button
                    variant="ghost"
                    size="icon-sm"
                    asChild
                    className="text-muted-foreground hover:text-foreground"
                    title="View"
                >
                    <Link href={`/inventory/configurations/uom/${row.id}/view`}>
                        <Eye className="size-3.5" />
                    </Link>
                </Button>
                <Button
                    variant="ghost"
                    size="icon-sm"
                    asChild
                    className="text-muted-foreground hover:text-foreground"
                    title="Edit"
                >
                    <Link href={`/inventory/configurations/uom/${row.id}/update`}>
                        <Edit2 className="size-3.5" />
                    </Link>
                </Button>
            </div>
        ),
    },
];

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

    const items = (initialData as InventoryUom[] | null) ?? [];

    return (
        <div className="space-y-6 p-4 md:p-8">
            <div className="flex items-start justify-between">
                <div>
                    <h2 className="flex items-center gap-2 text-xl font-semibold text-slate-800">
                        <Ruler className="size-5 text-emerald-500" />
                        Units of Measure
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Master list of units used across inventory items.
                    </p>
                </div>
                {permission.can_create && (
                    <Button size="sm" asChild>
                        <Link href="/inventory/configurations/uom/create">
                            <Plus className="size-3.5" />
                            New UOM
                        </Link>
                    </Button>
                )}
            </div>

            <DataTable
                columns={columns}
                data={items}
                keyExtractor={(row) => row.id}
                searchFn={(row, q) =>
                    row.name.toLowerCase().includes(q) ||
                    row.display_name.toLowerCase().includes(q)
                }
                searchPlaceholder="Search by name or abbreviation..."
                emptyIcon={<Ruler className="size-8" />}
                emptyTitle="No units of measure"
                emptyDescription="Create a UOM like Kilogram (kg) or Piece (pcs) to get started."
            />
        </div>
    );
}
