'use client';

import {
  ButtonActionDynamicRender,
  ButtonActionStaticRender,
} from '@/components/ui/button-action';
import {
  DataTable,
  type DataTableColumn,
  type DataTableFilterDef,
} from '@/components/ui/DataTable';
import { usePageActions } from '@/hook/usePageAction';
import type { ServerQueryBinding } from '@/hook/useTableQuery';
import type { InventoryItemProps } from '@/types/inventory/item';
import { Package, Percent, RotateCcw, ShieldCheck, Tags } from 'lucide-react';
import { JSX } from 'react';

function PropertyBadges({ item }: { item: InventoryItemProps }) {
  const badges: JSX.Element[] = [];

  if (item.is_warranty) {
    badges.push(
      <span
        key="w"
        title="Warranty"
        className="flex h-5 w-5 items-center justify-center rounded-md bg-blue-50 text-blue-500"
      >
        <ShieldCheck size={11} />
      </span>,
    );
  }
  if (item.is_discount) {
    badges.push(
      <span
        key="d"
        title="Discountable"
        className="flex h-5 w-5 items-center justify-center rounded-md bg-purple-50 text-purple-500"
      >
        <Percent size={11} />
      </span>,
    );
  }
  if (item.is_returnable) {
    badges.push(
      <span
        key="r"
        title="Returnable"
        className="flex h-5 w-5 items-center justify-center rounded-md bg-amber-50 text-amber-500"
      >
        <RotateCcw size={11} />
      </span>,
    );
  }
  if (item.is_sellable) {
    badges.push(
      <span
        key="s"
        title="Sellable"
        className="flex h-5 w-5 items-center justify-center rounded-md bg-blue-50 text-blue-500"
      >
        <Tags size={11} />
      </span>,
    );
  }

  if (badges.length === 0) return null;
  return <div className="mt-1 flex items-center gap-1">{badges}</div>;
}

const FILTER_DEFS: DataTableFilterDef[] = [
  {
    key: 'category_name',
    label: 'Category',
    type: 'text',
    placeholder: 'Filter by category…',
  },
  { key: 'is_sellable', label: 'Sellable', type: 'boolean' },
  { key: 'track_serial', label: 'Serialized', type: 'boolean' },
  { key: 'created_at', label: 'Created', type: 'date-range' },
];

export type StockFormProps = {
  items: Array<InventoryItemProps>;
  serverQuery: ServerQueryBinding;
  onDeleteAction: (id: number) => void;
};

export default function StockForm({
  items,
  serverQuery,
  onDeleteAction,
}: StockFormProps) {
  const pageAction = usePageActions();
  const staticActions = pageAction?.actions.filter((a) => !a.dynamic) ?? [];
  const dynamicActions = pageAction?.actions.filter((a) => a.dynamic) ?? [];

  const columns: DataTableColumn<InventoryItemProps>[] = [
    {
      key: 'reference_no',
      header: 'Reference',
      sortable: true,
      cell: (row) => (
        <span className="rounded bg-gray-100 px-2.5 py-1 font-mono text-xs text-gray-600">
          {row.reference_no || '—'}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'Item Name',
      sortable: true,
      cellClassName: 'whitespace-normal max-w-xs',
      cell: (row) => (
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="truncate font-mono text-xs text-gray-900">
              {row.name}
            </div>
            <div className="mt-0.5 truncate text-xs text-gray-500">
              {row.item_class === 'stock'
                ? 'Stock Item'
                : 'Non-Stock / Service'}
            </div>
            <PropertyBadges item={row} />
          </div>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      cell: (row) => (
        <span className="font-mono text-xs text-gray-700">
          {row.category?.name ?? '—'}
        </span>
      ),
    },
    {
      key: 'price',
      header: 'Pricing',
      sortable: true,
      cell: (row) => (
        <div className="font-mono text-xs">
          <span className="text-gray-900">
            ${(row.price ?? row.sale_price ?? 0).toFixed(2)}
          </span>
          {(row.min_price != null || row.max_price != null) && (
            <div className="mt-0.5 text-[10px] text-slate-400">
              {row.min_price != null && (
                <>Min: ${Number(row.min_price).toFixed(2)}</>
              )}
              {row.min_price != null && row.max_price != null && ' · '}
              {row.max_price != null && (
                <>Max: ${Number(row.max_price).toFixed(2)}</>
              )}
            </div>
          )}
        </div>
      ),
    },
    ...(dynamicActions.length > 0
      ? [
          {
            key: 'actions',
            header: 'Actions',
            headerClassName: 'text-right',
            cellClassName: 'text-right',
            cell: (row: InventoryItemProps) =>
              ButtonActionDynamicRender(dynamicActions, row, () =>
                onDeleteAction(row.id!),
              ),
          } satisfies DataTableColumn<InventoryItemProps>,
        ]
      : []),
  ];

  return (
    <div className="w-full min-w-0 space-y-5 font-mono">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h2 className="flex items-center gap-2 text-2xl text-slate-800">
            <Package className="text-[#1a9e52]" />
            Stock
          </h2>
          <p className="mt-1 text-slate-500">Manage your stock items</p>
        </div>
        <div className="flex items-center gap-2">
          {staticActions.map((action) => (
            <span key={action.key}>
              {ButtonActionStaticRender(action, false)}
            </span>
          ))}
        </div>
      </div>

      <DataTable<InventoryItemProps>
        columns={columns}
        data={items}
        keyExtractor={(row) => row.id ?? 0}
        searchPlaceholder="Search by name, SKU, reference..."
        pageSizeOptions={[10, 20, 50]}
        serverQuery={serverQuery}
        filterDefs={FILTER_DEFS}
        enableColumnVisibility
        emptyIcon={<Package size={32} />}
        emptyTitle="No stock items found"
        emptyDescription="No items match your search criteria"
      />
    </div>
  );
}
