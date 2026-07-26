'use client';

import { ButtonActionDynamicRender } from '@/components/ui/button-action';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Avatar } from '@/components/ui/Avatar';
import { DateTimeFormat } from '@/lib/utils/dateformat';
import type { Company } from '@/types/setting/company';
import type { Action } from '@/types';

export type TCompany = Company;

export function getCompanyColumns({
    dynamicActions,
}: {
    dynamicActions: Action;
}): DataTableColumn<TCompany>[] {
    return [
        {
            key: 'name',
            header: 'Company',
            primary: true,
            cell: (row) => (
                <div className="flex items-center gap-2.5">
                    <Avatar src={row.logo_url} name={row.name} size={32} />
                    <div>
                        <span className="font-medium text-foreground">
                            {row.name}
                        </span>
                        <p className="text-xs text-muted-foreground">
                            {row.domain ?? '—'}
                        </p>
                    </div>
                </div>
            ),
        },
        {
            key: 'contact',
            header: 'Contact',
            cell: (row) => (
                <div className="text-xs">
                    <p>{row.email || '—'}</p>
                    <p className="text-muted-foreground">{row.phone || ''}</p>
                </div>
            ),
        },
        {
            key: 'registration_number',
            header: 'Registration No',
            cell: (row) => (
                <span className="font-mono text-xs text-muted-foreground">
                    {row.registration_number || '—'}
                </span>
            ),
        },
        {
            key: 'status',
            header: 'Status',
            cell: (row) => (
                <StatusBadge
                    status={row.status.toUpperCase()}
                    label={row.status}
                />
            ),
        },
        {
            key: 'created_at',
            header: 'Created',
            cell: (row) => (
                <span className="font-mono text-xs text-muted-foreground">
                    {DateTimeFormat(row.created_at)}
                </span>
            ),
        },
        ...(dynamicActions.length > 0
            ? [
                  {
                      key: 'actions',
                      header: 'Actions',
                      cell: (row: TCompany) =>
                          ButtonActionDynamicRender(dynamicActions, row),
                  } satisfies DataTableColumn<TCompany>,
              ]
            : []),
    ];
}
