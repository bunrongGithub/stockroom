'use client';

import { ButtonActionDynamicRender } from '@/components/ui/button-action';
import type { DataTableColumn } from '@/components/ui/DataTable';
import type { Action } from '@/types';
import type { AppModule } from '@/types/app';

interface ModuleColumnsOptions {
    dynamicActions: Action;
    onDelete: (id: number) => void;
}

export function getModuleColumns({
    dynamicActions,
    onDelete,
}: ModuleColumnsOptions): DataTableColumn<AppModule>[] {
    return [
        {
            key: 'key',
            header: 'Key',
            cell: (row) => <span className="font-mono text-xs">{row.key}</span>,
        },
        {
            key: 'label',
            header: 'Label',
            cell: (row) => <span className="font-medium">{row.label}</span>,
        },
        {
            key: 'path',
            header: 'Path',
            cell: (row) => (
                <span className="text-xs text-muted-foreground">
                    {row.path}
                </span>
            ),
        },
        {
            key: 'type',
            header: 'Type',
            cell: (row) => (
                <span className="inline-block rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-800">
                    {row.type}
                </span>
            ),
        },
        {
            key: 'status',
            header: 'Status',
            cell: (row) => (
                <span
                    className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${
                        row.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                    }`}
                >
                    {row.is_active ? 'Active' : 'Inactive'}
                </span>
            ),
        },
        ...(dynamicActions.length > 0
            ? [
                  {
                      key: 'actions',
                      header: 'Actions',
                      cell: (row: AppModule) =>
                          ButtonActionDynamicRender(dynamicActions, row, () =>
                              onDelete(row.id),
                          ),
                  } satisfies DataTableColumn<AppModule>,
              ]
            : []),
    ];
}
