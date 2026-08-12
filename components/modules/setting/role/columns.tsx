'use client';

import { ButtonActionDynamicRender } from '@/components/ui/button-action';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { DateTimeFormat } from '@/lib/utils/dateformat';
import type { ColumnsOptionsProps } from '@/types/app';

export type TRole = {
    id: number;
    name: string;
    description: string | null;
    is_active: boolean;
    created_at: string;
    company: { id: number; name: string } | null;
};
export function getRoleColumns({
    dynamicActions,
    onDelete,
}: ColumnsOptionsProps): DataTableColumn<TRole>[] {
    return [
        {
            key: 'name',
            header: 'Name',
            primary: true,
            sortable: true,
            cell: (row) => (
                <span className="font-medium text-foreground">{row.name}</span>
            ),
        },
        {
            key: 'description',
            header: 'Description',
            cell: (row) => (
                <span className="text-xs text-muted-foreground">
                    {row.description || '—'}
                </span>
            ),
        },
        {
            key: 'company',
            header: 'Company Name',
            cell: (row) => (
                <span className="text-xs">{row.company?.name ?? '—'}</span>
            ),
        },
        {
            key: 'is_active',
            header: 'Status',
            sortable: true,
            cell: (row) => (
                <StatusBadge status={row.is_active ? 'ACTIVE' : 'INACTIVE'} />
            ),
        },
        {
            key: 'created_at',
            header: 'Created At',
            sortable: true,
            cell: (row) => (
                <span className="text-xs text-muted-foreground tnums">
                    {DateTimeFormat(row.created_at)}
                </span>
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
                      cell: (row: TRole) =>
                          ButtonActionDynamicRender(dynamicActions, row, () =>
                              onDelete(row.id),
                          ),
                  } satisfies DataTableColumn<TRole>,
              ]
            : []),
    ];
}
