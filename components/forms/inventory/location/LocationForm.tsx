'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Building2, Edit2, MapPin, Plus, Trash2, Warehouse } from 'lucide-react';

import { BranchProps } from '@/types/branch';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import BranchForm from '@/components/forms/inventory/configurations/BranchForm';

interface Props {
    branches: BranchProps[];
}

export default function LocationForm({ branches }: Props) {
    const router = useRouter();
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<BranchProps | null>(null);
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

    const showToast = (msg: string, type: 'success' | 'error') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const onDelete = async (id: number) => {
        if (!confirm('Delete this warehouse? This cannot be undone.')) return;
        try {
            const res = await fetch(`/api/branch/${id}`, { method: 'DELETE' });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error ?? 'Delete failed');
            showToast('Warehouse deleted.', 'success');
            router.refresh();
        } catch (err: unknown) {
            showToast(err instanceof Error ? err.message : 'Delete failed', 'error');
        }
    };

    const columns: DataTableColumn<BranchProps>[] = [
        {
            key: 'name',
            header: 'Warehouse',
            cell: (b) => (
                <div>
                    <p className="font-medium text-foreground">{b.name}</p>
                    <p className="text-xs text-muted-foreground">{b.reference_no}</p>
                </div>
            ),
        },
        {
            key: 'address',
            header: 'Address',
            cell: (b) =>
                b.address ? (
                    <span className="text-sm text-muted-foreground">{b.address}</span>
                ) : (
                    <span className="text-xs text-muted-foreground/50">—</span>
                ),
        },
        {
            key: 'locations',
            header: 'Locations',
            headerClassName: 'text-center',
            cellClassName: 'text-center',
            cell: (b) => {
                const count = b.stock_location?.length ?? 0;
                return (
                    <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary">
                        <MapPin className="size-3 shrink-0" />
                        {count}
                    </div>
                );
            },
        },
        {
            key: 'status',
            header: 'Status',
            cell: (b) =>
                b.is_active ? (
                    <Badge variant="secondary" className="text-emerald-700 border-emerald-200">
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
            cell: (b) => (
                <div className="flex items-center justify-end gap-1.5">
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setEditing(b)}
                        title="Edit"
                        className="text-muted-foreground hover:text-foreground"
                    >
                        <Edit2 className="size-3.5" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => onDelete(b.id)}
                        title="Delete"
                        className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                        <Trash2 className="size-3.5" />
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        asChild
                        className="border-primary/30 text-primary hover:bg-primary/5 hover:text-primary"
                    >
                        <Link href={`/inventory/configurations/location/${b.id}`}>
                            <Warehouse className="size-3.5" />
                            Locations
                        </Link>
                    </Button>
                </div>
            ),
        },
    ];

    return (
        <>
            {toast && (
                <div
                    className={`fixed right-4 top-4 z-60 rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${
                        toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
                    }`}
                >
                    {toast.msg}
                </div>
            )}

            {(showForm || editing) && (
                <BranchForm
                    branch={editing}
                    onClose={() => {
                        setShowForm(false);
                        setEditing(null);
                    }}
                    onSuccess={() => {
                        showToast(editing ? 'Warehouse updated.' : 'Warehouse created.', 'success');
                        router.refresh();
                    }}
                />
            )}

            <div className="space-y-6 p-4 md:p-8">
                <div className="flex items-start justify-between">
                    <div>
                        <h2 className="flex items-center gap-2 text-xl font-semibold">
                            <Building2 className="size-5 text-primary" />
                            Warehouses
                        </h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Manage warehouses and their storage locations.
                        </p>
                    </div>
                    <Button onClick={() => setShowForm(true)}>
                        <Plus />
                        New Warehouse
                    </Button>
                </div>

                <DataTable
                    columns={columns}
                    data={branches}
                    keyExtractor={(b) => b.id}
                    searchFn={(b, q) =>
                        b.name.toLowerCase().includes(q) ||
                        b.reference_no.toLowerCase().includes(q)
                    }
                    searchPlaceholder="Search by name or reference..."
                    emptyIcon={<Building2 className="size-8" />}
                    emptyTitle="No warehouses yet"
                    emptyDescription="Create your first warehouse to start managing stock."
                    emptyAction={
                        <Button size="sm" onClick={() => setShowForm(true)}>
                            <Plus />
                            New Warehouse
                        </Button>
                    }
                />
            </div>
        </>
    );
}
