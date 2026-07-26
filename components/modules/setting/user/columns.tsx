'use client';

import { ButtonActionDynamicRender } from '@/components/ui/button-action';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Avatar } from '@/components/ui/Avatar';
import { DateTimeFormat } from '@/lib/utils/dateformat';
import type { CompanyUser } from '@/service/apps/base/user/repo/user.repo';
import type { ColumnsOptionsProps } from '@/types/app';

export type TUser = CompanyUser;

export function getUserColumns({
  dynamicActions,
  onDelete,
}: ColumnsOptionsProps): DataTableColumn<TUser>[] {
  return [
    {
      key: 'name',
      header: 'Name',
      primary: true,
      cell: (row) => (
        <div className="flex items-center gap-2.5">
          <Avatar
            src={row.avatar_url}
            name={row.full_name ?? row.email}
            size={32}
          />
          <div>
            <span className="font-medium text-foreground">
              {row.full_name ?? '—'}
            </span>
            <p className="text-xs text-muted-foreground">{row.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'roles',
      header: 'Roles',
      cell: (row) =>
        row.roles.length ? (
          <div className="flex flex-wrap gap-1">
            {row.roles.map((r) => (
              <span
                key={r.id}
                className="inline-block rounded-full bg-info-muted px-2 py-0.5 text-xs text-info"
              >
                {r.name}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">No roles</span>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => (
        <StatusBadge
          status={row.status === 'active' ? 'ACTIVE' : 'INACTIVE'}
        />
      ),
    },
    {
      key: 'last_login',
      header: 'Last Login',
      cell: (row) => (
        <span className="font-mono text-xs text-muted-foreground">
          {row.last_login_at ? DateTimeFormat(row.last_login_at) : '—'}
        </span>
      ),
    },
    {
      key: 'created_at',
      header: 'Joined',
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
            cell: (row: TUser) =>
              ButtonActionDynamicRender(dynamicActions, row, () =>
                onDelete(Number(row.id)),
              ),
          } satisfies DataTableColumn<TUser>,
        ]
      : []),
  ];
}
