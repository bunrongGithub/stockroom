'use client';

import { ButtonActionDynamicRender } from '@/components/ui/button-action';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { DateTimeFormat } from '@/lib/utils/dateformat';
import type { ColumnsOptionsProps } from '@/types/app';

export type TWarehouse = {
  id: number;
  name: string;
  reference_no: string;
  code: string | null;
  address: string | null;
  phone: string | null;
  is_active: boolean;
  description: string | null;
  created_at: string;
  updated_at: string | null;
  company_id: number;
  company: { id: number; name: string };
};
export function getWarehouseCols({
  dynamicActions,
  onDelete,
}: ColumnsOptionsProps): DataTableColumn<TWarehouse>[] {
  return [
    {
      key: 'name',
      header: 'Name',
      cell: (row) => <span className="font-mono text-xs">{row.name}</span>,
    },
    {
      key: 'company',
      header: 'Company Name',
      cell: (row) => (
        <span className="font-mono text-xs">{row.company?.name}</span>
      ),
    },
    {
      key: 'address',
      header: 'Address',
      cell: (row) => <span>{row.address ?? 'N/A'}</span>,
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
            cell: (row: TWarehouse) =>
              ButtonActionDynamicRender(dynamicActions, row, () =>
                onDelete(row.id),
              ),
          } satisfies DataTableColumn<TWarehouse>,
        ]
      : []),
  ];
}
