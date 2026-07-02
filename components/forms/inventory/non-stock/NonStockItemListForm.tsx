'use client';

import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { InventoryItem } from '@/service/apps/inventory/repo/stock';
import { Edit2, Eye, Package, Percent, RotateCcw, ShieldCheck, Tag } from 'lucide-react';
import Link from 'next/link';

function PropertyBadges({ item }: { item: InventoryItem }) {
    return (
        <div className="flex items-center gap-1">
            {(item.is_warranty || !!item.warranty_duration) && (
                <span title="Warranty" className="flex h-5 w-5 items-center justify-center rounded-md bg-blue-50 text-blue-500">
                    <ShieldCheck size={11} />
                </span>
            )}
            {item.is_discount && (
                <span title="Discountable" className="flex h-5 w-5 items-center justify-center rounded-md bg-purple-50 text-purple-500">
                    <Percent size={11} />
                </span>
            )}
            {item.is_returnable && (
                <span title="Returnable" className="flex h-5 w-5 items-center justify-center rounded-md bg-amber-50 text-amber-500">
                    <RotateCcw size={11} />
                </span>
            )}
            {item.is_sellable && (
                <span title="Sellable" className="flex h-5 w-5 items-center justify-center rounded-md bg-emerald-50 text-emerald-500">
                    <Tag size={11} />
                </span>
            )}
        </div>
    );
}

const columns: DataTableColumn<InventoryItem>[] = [
    {
        key: 'reference_no',
        header: 'Reference',
        cell: (row) => (
            <span className="rounded bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">
                {row.reference_no || '—'}
            </span>
        ),
    },
    {
        key: 'name',
        header: 'Item Name',
        cell: (row) => (
            <div>
                <p className="text-sm font-semibold text-gray-900">{row.name}</p>
                <p className="text-xs text-gray-400 font-mono">{row.sku || '—'}</p>
                <PropertyBadges item={row} />
            </div>
        ),
    },
    {
        key: 'category',
        header: 'Category',
        cell: (row) => (
            <span className="text-sm text-muted-foreground">{row.category?.name ?? '—'}</span>
        ),
    },
    {
        key: 'price',
        header: 'Sale Price',
        headerClassName: 'text-right',
        cellClassName: 'text-right tabular-nums',
        cell: (row) => (
            <div>
                <span className="font-semibold text-emerald-700">${Number(row.price).toFixed(2)}</span>
                {row.cost != null && (
                    <p className="text-[10px] text-slate-400">Cost: ${Number(row.cost).toFixed(2)}</p>
                )}
            </div>
        ),
    },
    {
        key: 'status',
        header: 'Status',
        cell: (row) => (
            row.is_sellable ? (
                <Badge variant="secondary" className="border-emerald-200 bg-emerald-50 text-emerald-700">Active</Badge>
            ) : (
                <Badge variant="outline">Inactive</Badge>
            )
        ),
    },
    {
        key: 'actions',
        header: '',
        headerClassName: 'w-0',
        cell: (row) => (
            <div className="flex items-center justify-end gap-1">
                <Button variant="ghost" size="icon-sm" asChild className="text-muted-foreground hover:text-foreground" title="View">
                    <Link href={`/inventory/configurations/non-stock/${row.id}/view`}>
                        <Eye className="size-3.5" />
                    </Link>
                </Button>
                <Button variant="ghost" size="icon-sm" asChild className="text-muted-foreground hover:text-foreground" title="Edit">
                    <Link href={`/inventory/configurations/non-stock/${row.id}/edit`}>
                        <Edit2 className="size-3.5" />
                    </Link>
                </Button>
            </div>
        ),
    },
];

export default function NonStockItemListForm({ items = [] }: { items: InventoryItem[] }) {
    return (
        <div className="space-y-6 p-4 md:p-8">
            <div className="flex items-start justify-between">
                <div>
                    <h2 className="flex items-center gap-2 text-xl font-semibold">
                        <Package className="size-5 text-primary" />
                        Non-Stock Items
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Services and non-physical inventory items.
                    </p>
                </div>
                <Button size="sm" asChild>
                    <Link href="/inventory/configurations/non-stock-item/create">
                        <Package className="size-3.5" />
                        New Non-Stock Item
                    </Link>
                </Button>
            </div>

            <DataTable
                columns={columns}
                data={items}
                keyExtractor={(row) => row.id}
                searchFn={(row, q) =>
                    row.name.toLowerCase().includes(q) ||
                    (row.reference_no ?? '').toLowerCase().includes(q) ||
                    (row.sku ?? '').toLowerCase().includes(q) ||
                    (row.category?.name ?? '').toLowerCase().includes(q)
                }
                searchPlaceholder="Search by name, reference, category..."
                emptyIcon={<Package className="size-8" />}
                emptyTitle="No non-stock items"
                emptyDescription="Create a non-stock or service item to get started."
            />
        </div>
    );
}
