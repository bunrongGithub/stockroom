'use client';

import { ButtonActionDynamicRender } from '@/components/ui/button-action';
import type { DataTableColumn } from '@/components/ui/DataTable';
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
            cell: (row) => (
                <span className="font-mono text-xs">{row.name}</span>
            ),
        },
        {
            key: 'description',
            header: 'Description',
            cell: (row) => (
                <span className="font-mono text-xs">{row.description}</span>
            ),
        },
        {
            key: 'company',
            header: 'Company Name',
            cell: (row) => (
                <span className="font-mono text-xs">{row.company?.name}</span>
            ),
        },
        {
            key: 'is_active',
            header: 'Status',
            cell: (row) => (
                <span
                    className={`inline-block rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold ${
                        row.is_active
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-slate-100 text-slate-500'
                    }`}
                >
                    {row.is_active ? 'Active' : 'Inactive'}
                </span>
            ),
        },
        {
            key: 'created_at',
            header: 'Created At',
            cell: (row) => (
                <span className="font-mono text-xs">
                    {DateTimeFormat(row.created_at)}
                </span>
            ),
        },
        ...(dynamicActions.length > 0
            ? [
                  {
                      key: 'actions',
                      header: 'Actions',
                      cell: (row: TRole) =>
                          ButtonActionDynamicRender(dynamicActions, row, () =>
                              onDelete(row.id),
                          ),
                  } satisfies DataTableColumn<TRole>,
              ]
            : []),
    ];
}
