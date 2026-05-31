'use client';

import Link from 'next/link';
import { Box, Edit2, Eye, Package, ShieldCheck, Wrench } from 'lucide-react';
import { useMemo } from 'react';

import { InventoryItemProps } from '@/types/inventory/item';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

/* ── Types ── */

interface RepairServiceItem {
    id: number;
    name: string;
    reference_no: string;
    device_id: number | null;
    category_id: number | null;
    labor_cost: number;
    parts_cost: number;
    sale_price: number;
    warranty_duration: string | null;
    has_warranty: boolean;
    difficulty: string;
    is_active: boolean;
    description: string | null;
    device?: { id: number; name: string; brand: string | null; device_type: string } | null;
    category?: { id: number; name: string } | null;
}

type InventoryRow = InventoryItemProps & { _type: 'inventory' };
type ServiceRow = RepairServiceItem & { _type: 'service' };
type UnifiedRow = InventoryRow | ServiceRow;

interface Props {
    items: InventoryItemProps[];
    services: RepairServiceItem[];
}

/* ── Type badge ── */

function TypeBadge({ row }: { row: UnifiedRow }) {
    if (row._type === 'service') {
        return (
            <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-700">
                Repair
            </Badge>
        );
    }
    switch (row.item_class) {
        case 'stock':
            return (
                <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                    Stock
                </Badge>
            );
        case 'non_stock':
            return (
                <Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-700">
                    Non-Stock
                </Badge>
            );
        case 'service':
            return (
                <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
                    Service
                </Badge>
            );
    }
}

/* ── Difficulty badge (repair only) ── */

function DifficultyBadge({ difficulty }: { difficulty: string }) {
    const map: Record<string, { label: string; className: string }> = {
        easy: { label: 'Easy', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
        hard: { label: 'Hard', className: 'border-red-200 bg-red-50 text-red-700' },
        medium: { label: 'Medium', className: 'border-blue-200 bg-blue-50 text-blue-700' },
    };
    const cfg = map[difficulty] ?? map['medium'];
    return (
        <Badge variant="outline" className={cfg.className}>
            {cfg.label}
        </Badge>
    );
}

/* ── Columns ── */

const columns: DataTableColumn<UnifiedRow>[] = [
    {
        key: 'type',
        header: 'Type',
        cell: (row) => <TypeBadge row={row} />,
    },
    {
        key: 'name',
        header: 'Name',
        cell: (row) => (
            <div>
                <p className="font-medium text-foreground">{row.name}</p>
                <p className="font-mono text-xs text-muted-foreground">{row.reference_no}</p>
            </div>
        ),
    },
    {
        key: 'category',
        header: 'Category',
        cell: (row) => {
            const cat = row.category;
            return cat ? (
                <span className="text-sm text-muted-foreground">{cat.name}</span>
            ) : null;
        },
    },
    {
        key: 'detail',
        header: 'Detail',
        cell: (row) => {
            if (row._type === 'service') {
                return (
                    <div className="flex flex-col gap-0.5">
                        {row.device && (
                            <span className="text-xs text-muted-foreground">
                                {row.device.brand ? `${row.device.brand} ` : ''}
                                {row.device.name}
                            </span>
                        )}
                        <DifficultyBadge difficulty={row.difficulty} />
                    </div>
                );
            }
            return row.uom ? (
                <span className="text-xs text-muted-foreground">{row.uom.name}</span>
            ) : null;
        },
    },
    {
        key: 'price',
        header: 'Sale Price',
        headerClassName: 'text-right',
        cellClassName: 'text-right tabular-nums',
        cell: (row) => (
            <span className="font-semibold text-emerald-700">
                ${Number(row.sale_price).toFixed(2)}
            </span>
        ),
    },
    {
        key: 'warranty',
        header: 'Warranty',
        cell: (row) => {
            if (row._type === 'service' && row.has_warranty) {
                return (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600">
                        <ShieldCheck className="size-3.5" />
                        {row.warranty_duration ?? 'Yes'}
                    </span>
                );
            }
            if (row._type === 'inventory' && row.warranty_duration) {
                return (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600">
                        <ShieldCheck className="size-3.5" />
                        {row.warranty_duration}
                    </span>
                );
            }
            return null;
        },
    },
    {
        key: 'status',
        header: 'Status',
        cell: (row) => {
            if (row._type === 'service') {
                return row.is_active ? (
                    <Badge variant="secondary" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                        Active
                    </Badge>
                ) : (
                    <Badge variant="outline">Inactive</Badge>
                );
            }
            return (
                <Badge variant="secondary" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                    Active
                </Badge>
            );
        },
    },
    {
        key: 'actions',
        header: '',
        headerClassName: 'w-0',
        cell: (row) => {
            const id = row.id;
            const isService = row._type === 'service';
            const editHref = isService
                ? `/inventory/configurations/none_stock/${id}/update`
                : `/inventory/configurations/stock/${id}/edit`;
            const viewHref = isService
                ? `/inventory/configurations/none_stock/${id}/view`
                : `/inventory/configurations/stock/${id}/view`;

            return (
                <div className="flex items-center justify-end gap-1">
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        asChild
                        className="text-muted-foreground hover:text-foreground"
                        title="View"
                    >
                        <Link href={viewHref}>
                            <Eye className="size-3.5" />
                        </Link>
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        asChild
                        className="text-muted-foreground hover:text-foreground"
                        title="Edit"
                    >
                        <Link href={editHref}>
                            <Edit2 className="size-3.5" />
                        </Link>
                    </Button>
                </div>
            );
        },
    },
];

/* ── Main Component ── */

export default function NoneStockForm({ items = [], services = [] }: Props) {
    const rows = useMemo<UnifiedRow[]>(
        () => [
            ...items.map((i) => ({ ...i, _type: 'inventory' as const })),
            ...services.map((s) => ({ ...s, _type: 'service' as const })),
        ],
        [items, services],
    );

    const stockCount = items.filter((i) => i.item_class === 'stock').length;
    const nonStockCount = items.filter((i) => i.item_class !== 'stock').length;
    const serviceCount = services.length;

    return (
        <div className="space-y-6 p-4 md:p-8">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h2 className="flex items-center gap-2 text-xl font-semibold">
                        <Package className="size-5 text-primary" />
                        Items &amp; Services
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        All inventory items and repair services in one view.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" asChild>
                        <Link href="/inventory/configurations/stock/create">
                            <Box className="size-3.5" />
                            New Item
                        </Link>
                    </Button>
                    <Button size="sm" asChild>
                        <Link href="/inventory/configurations/none_stock/create">
                            <Wrench className="size-3.5" />
                            New Service
                        </Link>
                    </Button>
                </div>
            </div>

            {/* Summary chips */}
            <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                    <Box className="size-3" />
                    {stockCount} Stock
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-medium text-orange-700">
                    <Package className="size-3" />
                    {nonStockCount} Non-Stock / Service
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700">
                    <Wrench className="size-3" />
                    {serviceCount} Repair Services
                </span>
            </div>

            {/* Unified table */}
            <DataTable
                columns={columns}
                data={rows}
                keyExtractor={(row) => `${row._type}-${row.id}`}
                searchFn={(row, q) =>
                    row.name.toLowerCase().includes(q) ||
                    row.reference_no.toLowerCase().includes(q) ||
                    (row.category?.name ?? '').toLowerCase().includes(q) ||
                    (row._type === 'service'
                        ? (row.device?.name ?? '').toLowerCase().includes(q)
                        : row.item_class.toLowerCase().includes(q))
                }
                searchPlaceholder="Search by name, ref, category..."
                emptyIcon={<Package className="size-8" />}
                emptyTitle="No items or services"
                emptyDescription="Create a stock item or repair service to get started."
            />
        </div>
    );
}
