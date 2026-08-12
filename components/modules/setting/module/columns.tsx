'use client';

import { ButtonActionDynamicRender } from '@/components/ui/button-action';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { AppModule, ColumnsOptionsProps } from '@/types/app';

export function getModuleColumns({
    dynamicActions,
    onDelete,
}: ColumnsOptionsProps): DataTableColumn<AppModule>[] {
    return [
        {
            key: 'label',
            header: 'Label',
            primary: true,
            sortable: true,
            cell: (row) => (
                <span className="font-medium text-foreground">{row.label}</span>
            ),
        },
        {
            key: 'key',
            header: 'Key',
            sortable: true,
            cell: (row) => (
                <span className="text-xs text-muted-foreground">{row.key}</span>
            ),
        },
        {
            key: 'path',
            header: 'Path',
            sortable: true,
            cell: (row) => <span className="text-xs">{row.path}</span>,
        },
        {
            key: 'type',
            header: 'Type',
            sortable: true,
            cell: (row) => <span className="text-xs capitalize">{row.type}</span>,
        },
        {
            key: 'status',
            header: 'Status',
            sortable: true,
            sortKey: 'is_active',
            cell: (row) => (
                <StatusBadge status={row.is_active ? 'ACTIVE' : 'INACTIVE'} />
            ),
        },
        ...(dynamicActions.length > 0
            ? [
                  {
                      key: 'actions',
                      header: 'Actions',
                      sticky: 'right',
                      align: 'right',
                      cardFooter: true,
                      cell: (row: AppModule) =>
                          ButtonActionDynamicRender(dynamicActions, row, () =>
                              onDelete(row.id),
                          ),
                  } satisfies DataTableColumn<AppModule>,
              ]
            : []),
    ];
}
