import { DataTableColumn } from '@/components/ui/DataTable';
import { User } from './page';
import { AppModule, ColumnsOptionsProps } from '@/types/app';
import { ButtonActionDynamicRender } from '@/components/ui/button-action';

export function getUserColumns({
  dynamicActions,
  onDelete,
}: ColumnsOptionsProps): DataTableColumn<User>[] {
  return [
    {
      key: 'email',
      header: 'Email',
      cell: (row) => <span className="font-mono text-xs">{row.email}</span>,
    },
    {
      key: 'full_name',
      header: 'Full Name',
      cell: (row) => <span className="font-mono text-xs">{row.full_name}</span>,
    },
    {
      key: 'company',
      header: 'Company Name',
      cell: (row) => (
        <span className="font-mono text-xs">{row.company_name}</span>
      ),
    },
    ...(dynamicActions.length > 0
      ? [
          {
            key: 'actions',
            header: 'Actions',
            cell: (row: User) =>
              ButtonActionDynamicRender(dynamicActions, row, () =>
                onDelete(parseInt(row.id)),
              ),
          } satisfies DataTableColumn<User>,
        ]
      : []),
  ];
}
