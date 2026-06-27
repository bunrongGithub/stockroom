'use client';

import {
  ButtonActionDynamicRender,
  ButtonActionStaticRender,
} from '@/components/ui/button-action';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { usePageActions } from '@/hook/usePageAction';
import type { TMeta } from '@/types/app';
import type { InventoryItemProps } from '@/types/inventory/item';
import {
  Package,
  Percent,
  RotateCcw,
  ShieldCheck,
  Tags,
} from 'lucide-react';
import Image from 'next/image';
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

export type StockFormProps = {
  items: Array<InventoryItemProps>;
  meta: TMeta;
  onFetchPageAction: (page: number, limit: number) => void;
  onDeleteAction: (id: number) => void;
};

export default function StockForm({
  items,
  meta,
  onFetchPageAction,
  onDeleteAction,
}: StockFormProps) {
  const pageAction = usePageActions();
  const staticActions = pageAction?.actions.filter((a) => !a.dynamic) ?? [];
  const dynamicActions = pageAction?.actions.filter((a) => a.dynamic) ?? [];


  const columns: DataTableColumn<InventoryItemProps>[] = [
    {
      key: 'reference_no',
      header: 'Reference',
      cell: (row) => (
        <span className="rounded bg-gray-100 px-2.5 py-1 font-mono text-xs text-gray-600">
          {row.reference_no || '—'}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'Item Name',
      cellClassName: 'whitespace-normal max-w-xs',
      cell: (row) => (
        <div className="flex items-start gap-2">
          {row.images_url && row.images_url.length > 0 ? (
            <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-gray-200">
              <Image
                src={row.images_url[0]}
                alt={row.name}
                width={36}
                height={36}
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-gray-100 text-gray-400">
              <Package size={16} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate font-mono text-xs text-gray-900">{row.name}</div>
            <div className="mt-0.5 truncate text-xs text-gray-500">
              {row.item_class === 'stock' ? 'Stock Item' : 'Non-Stock / Service'}
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
            Item Stock
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
        searchFn={(row, q) =>
          row.name.toLowerCase().includes(q) ||
          (row.reference_no ?? '').toLowerCase().includes(q) ||
          (row.category?.name ?? '').toLowerCase().includes(q) ||
          (row.brand ?? '').toLowerCase().includes(q)
        }
        searchPlaceholder="Search by name, SKU, category..."
        pageSize={meta.limit}
        pageSizeOptions={[10, 20, 50]}
        serverSide={{
          total: meta.total,
          page: meta.page,
          totalPages: meta.totalPages,
          onPageChange: (p) => onFetchPageAction(p, meta.limit),
          onPageSizeChange: (limit) => onFetchPageAction(1, limit),
        }}
        emptyIcon={<Package size={32} />}
        emptyTitle="No stock items found"
        emptyDescription="No items match your search criteria"
      />
    </div>
  );
}
