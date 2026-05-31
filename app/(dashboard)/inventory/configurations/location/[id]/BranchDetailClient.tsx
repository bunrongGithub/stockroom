'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    ArrowLeft,
    ArrowRightLeft,
    Box,
    Edit2,
    MapPin,
    Package,
    Plus,
    Star,
    Trash2,
    Warehouse,
} from 'lucide-react';

import { StockLocationProps } from '@/types/branch';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import StockLocationForm from '@/components/forms/inventory/configurations/StockLocationForm';
import StockTransferModal from '@/components/forms/inventory/configurations/StockTransferModal';

/* ── Types ── */

interface BalanceRow {
    id: number;
    quantity: number;
    item_id: number;
    location_id: number;
    inventory_item: {
        id: number;
        name: string;
        sku: string | null;
        reference_no: string;
        price: number;
        sale_price: number | null;
        images_url: unknown;
    };
}

interface BranchData {
    id: number;
    name: string;
    reference_no: string;
    is_active: boolean;
}

interface Props {
    branch: BranchData;
    locations: StockLocationProps[];
    balances: BalanceRow[];
}

/* ── Stat card ── */

function StatCard({
    icon: Icon,
    label,
    value,
}: {
    icon: React.ElementType;
    label: string;
    value: number;
}) {
    return (
        <div className="flex items-center gap-3 rounded-lg shadow-sm bg-card p-4">
            <div className="flex size-9 items-center justify-center rounded-md bg-muted">
                <Icon className="size-4 text-muted-foreground" />
            </div>
            <div>
                <p className="text-lg font-semibold leading-none">{value}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
            </div>
        </div>
    );
}

/* ══════════════════════ MAIN COMPONENT ══════════════════════ */

export default function BranchDetailClient({
    branch,
    locations,
    balances,
}: Props) {
    const router = useRouter();

    const [showLocationForm, setShowLocationForm] = useState(false);
    const [editingLocation, setEditingLocation] =
        useState<StockLocationProps | null>(null);
    const [showTransfer, setShowTransfer] = useState(false);
    const [transferFromId, setTransferFromId] = useState<number | null>(null);
    const [transferItemId, setTransferItemId] = useState<number | null>(null);
    const [toast, setToast] = useState<{
        msg: string;
        type: 'success' | 'error';
    } | null>(null);

    const showToast = (msg: string, type: 'success' | 'error') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const locationMap = useMemo(
        () => new Map(locations.map((l) => [l.id, l])),
        [locations],
    );

    const totalUnits = balances.reduce((s, b) => s + b.quantity, 0);
    const totalSKUs = new Set(balances.map((b) => b.item_id)).size;

    const onDeleteLocation = async (id: number) => {
        if (!confirm('Delete this location? Stock will be affected.')) return;
        try {
            const res = await fetch(`/api/stock-location/${id}`, {
                method: 'DELETE',
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error ?? 'Delete failed');
            showToast('Location deleted.', 'success');
            router.refresh();
        } catch (err: unknown) {
            showToast(
                err instanceof Error ? err.message : 'Delete failed',
                'error',
            );
        }
    };

    /* ── Location table columns ── */
    const locationColumns: DataTableColumn<StockLocationProps>[] = [
        {
            key: 'name',
            header: 'Name',
            cell: (loc) => (
                <div>
                    <p className="font-medium">{loc.name}</p>
                    {loc.code && (
                        <p className="font-mono text-xs text-muted-foreground">
                            {loc.code}
                        </p>
                    )}
                </div>
            ),
        },
        {
            key: 'default',
            header: 'Default',
            headerClassName: 'text-center',
            cellClassName: 'text-center',
            cell: (loc) =>
                loc.is_default ? (
                    <Star className="mx-auto size-4 fill-amber-400 text-amber-400" />
                ) : (
                    <span className="text-muted-foreground/30">—</span>
                ),
        },
        {
            key: 'status',
            header: 'Status',
            cell: (loc) =>
                loc.is_active ? (
                    <Badge
                        variant="secondary"
                        className="bg-emerald-50 text-emerald-700 border-emerald-200"
                    >
                        Active
                    </Badge>
                ) : (
                    <Badge variant="outline">Inactive</Badge>
                ),
        },
        {
            key: 'actions',
            header: '',
            headerClassName: 'w-0',
            cell: (loc) => (
                <div className="flex items-center justify-end gap-1">
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => {
                            setTransferFromId(loc.id);
                            setShowTransfer(true);
                        }}
                        title="Transfer stock"
                    >
                        <ArrowRightLeft />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setEditingLocation(loc)}
                        title="Edit"
                    >
                        <Edit2 />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => onDeleteLocation(loc.id)}
                        title="Delete"
                    >
                        <Trash2 />
                    </Button>
                </div>
            ),
        },
    ];

    /* ── Balance table columns ── */
    const balanceColumns: DataTableColumn<BalanceRow>[] = [
        {
            key: 'item',
            header: 'Item',
            cell: (b) => (
                <div>
                    <p className="font-medium">{b.inventory_item.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                        {b.inventory_item.sku ?? b.inventory_item.reference_no}
                    </p>
                </div>
            ),
        },
        {
            key: 'location',
            header: 'Location',
            cell: (b) => {
                const loc = locationMap.get(b.location_id);
                return loc ? (
                    <span className="text-sm">{loc.name}</span>
                ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                );
            },
        },
        {
            key: 'qty',
            header: 'Qty',
            headerClassName: 'text-right',
            cellClassName: 'text-right tabular-nums',
            cell: (b) => <span className="font-semibold">{b.quantity}</span>,
        },
        {
            key: 'actions',
            header: '',
            headerClassName: 'w-0',
            cell: (b) => (
                <div className="flex justify-end">
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Transfer"
                        onClick={() => {
                            setTransferFromId(b.location_id);
                            setTransferItemId(b.item_id);
                            setShowTransfer(true);
                        }}
                    >
                        <ArrowRightLeft />
                    </Button>
                </div>
            ),
        },
    ];

    return (
        <>
            {/* Toast */}
            {toast && (
                <div
                    className={`fixed right-4 top-4 z-60 rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${
                        toast.type === 'success'
                            ? 'bg-emerald-500 text-white'
                            : 'bg-rose-500 text-white'
                    }`}
                >
                    {toast.msg}
                </div>
            )}

            {/* Modals */}
            {(showLocationForm || editingLocation) && (
                <StockLocationForm
                    branchId={branch.id}
                    location={editingLocation}
                    onClose={() => {
                        setShowLocationForm(false);
                        setEditingLocation(null);
                    }}
                    onSuccess={() => {
                        showToast(
                            editingLocation
                                ? 'Location updated.'
                                : 'Location created.',
                            'success',
                        );
                        router.refresh();
                    }}
                />
            )}

            {showTransfer && (
                <StockTransferModal
                    branchId={branch.id}
                    locations={locations}
                    preselectedFromId={transferFromId}
                    preselectedItemId={transferItemId}
                    onClose={() => {
                        setShowTransfer(false);
                        setTransferFromId(null);
                        setTransferItemId(null);
                    }}
                    onSuccess={() => {
                        showToast('Stock transferred.', 'success');
                        router.refresh();
                    }}
                />
            )}

            {/* Page */}
            <div className="space-y-6 p-4 md:p-8">
                {/* Breadcrumb */}
                <Link
                    href="/inventory/configurations/location"
                    className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
                >
                    <ArrowLeft className="size-4" />
                    Warehouses
                </Link>

                {/* Header */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <h1 className="flex items-center gap-2 text-xl font-semibold">
                            <Warehouse className="size-5 text-primary" />
                            {branch.name}
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Ref: {branch.reference_no}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setShowTransfer(true)}
                        >
                            <ArrowRightLeft />
                            Transfer Stock
                        </Button>
                        <Button onClick={() => setShowLocationForm(true)}>
                            <Plus />
                            New Location
                        </Button>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 ">
                    <StatCard
                        icon={MapPin}
                        label="Locations"
                        value={locations.length}
                    />
                    <StatCard
                        icon={Package}
                        label="Active"
                        value={locations.filter((l) => l.is_active).length}
                    />
                </div>

                <Separator />

                {/* Locations table */}
                <div>
                    <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                        Warehouse Locations
                    </h2>
                    <DataTable
                        columns={locationColumns}
                        data={locations}
                        keyExtractor={(l) => l.id}
                        searchFn={(l, q) =>
                            l.name.toLowerCase().includes(q) ||
                            (l.code ?? '').toLowerCase().includes(q)
                        }
                        searchPlaceholder="Search locations..."
                        toolbar={
                            <Button
                                size="sm"
                                onClick={() => setShowLocationForm(true)}
                            >
                                <Plus />
                                New Location
                            </Button>
                        }
                        emptyIcon={<MapPin className="size-8" />}
                        emptyTitle="No locations yet"
                        emptyDescription="Add your first storage location to this warehouse."
                        emptyAction={
                            <Button
                                size="sm"
                                onClick={() => setShowLocationForm(true)}
                            >
                                <Plus />
                                New Location
                            </Button>
                        }
                    />
                </div>

                <Separator />

                {/* Stock balance table */}
                <div>
                    <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                        Stock on Hand
                    </h2>
                    <DataTable
                        columns={balanceColumns}
                        data={balances}
                        keyExtractor={(b) => b.id}
                        searchFn={(b, q) =>
                            b.inventory_item.name.toLowerCase().includes(q) ||
                            (b.inventory_item.sku ?? '')
                                .toLowerCase()
                                .includes(q) ||
                            b.inventory_item.reference_no
                                .toLowerCase()
                                .includes(q)
                        }
                        searchPlaceholder="Search items..."
                        emptyIcon={<Package className="size-8" />}
                        emptyTitle="No stock in this warehouse"
                        emptyDescription="Receive or transfer inventory to see stock here."
                    />
                </div>
            </div>
        </>
    );
}
