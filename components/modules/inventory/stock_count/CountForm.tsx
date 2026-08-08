'use client';

import AsyncSearchSelect from '@/components/ui/AsyncSearchSelect';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/Toast';
import { API } from '@/lib/constant';
import { stockCountApi } from '@/lib/api/stock-count';
import type { CreateStockCountInput } from '@/service/schema/stock-count.schema';
import type { StockCount, StockCountMode } from '@/types/inventory/stock-count';
import { AlertCircle, ArrowLeftIcon, ClipboardList, Loader2Icon, SaveIcon, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const MODE_LABEL: Record<StockCountMode, string> = {
    full: 'Full Warehouse',
    location: 'Single Location',
    category: 'By Category',
    items: 'Specific Items',
};

export default function CountForm({
    mode,
    initial,
}: {
    mode: 'create' | 'edit';
    initial?: StockCount;
}) {
    const router = useRouter();
    const toast = useToast();
    const today = new Date().toISOString().slice(0, 10);

    const [countDate, setCountDate] = useState(initial?.count_date?.slice(0, 10) ?? today);
    const [warehouse, setWarehouse] = useState<{ id: number | null; name: string }>({
        id: initial?.warehouse_id ?? null,
        name: initial?.warehouse_name ?? '',
    });
    const [location, setLocation] = useState<{ id: number | null; name: string }>({
        id: initial?.location_id ?? null,
        name: initial?.location_name ?? '',
    });
    const [countMode, setCountMode] = useState<StockCountMode>(initial?.count_mode ?? 'full');
    // v1 scope: a single category / item pick (labels for pre-existing ids are
    // not resolvable client-side, so an edited scope shows the raw id).
    const [category, setCategory] = useState<{ id: number | null; name: string }>(() => {
        const id = initial?.scope_filter?.category_ids?.[0] ?? null;
        return { id, name: id ? `Category #${id}` : '' };
    });
    const [item, setItem] = useState<{ id: number | null; name: string }>(() => {
        const id = initial?.scope_filter?.item_ids?.[0] ?? null;
        return { id, name: id ? `Item #${id}` : '' };
    });
    const [remarks, setRemarks] = useState(initial?.remarks ?? '');

    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    async function handleSubmit() {
        setError('');
        if (!warehouse.id) return setError('Select a warehouse.');
        if (countMode === 'location' && !location.id) return setError('A single-location count requires a location.');
        if (countMode === 'category' && !category.id) return setError('Select a category to count.');
        if (countMode === 'items' && !item.id) return setError('Select an item to count.');

        setSaving(true);
        try {
            const payload: CreateStockCountInput = {
                count_date: countDate,
                warehouse_id: warehouse.id,
                location_id: location.id ?? null,
                count_mode: countMode,
                scope_filter:
                    countMode === 'category'
                        ? { category_ids: [category.id!] }
                        : countMode === 'items'
                          ? { item_ids: [item.id!] }
                          : {},
                remarks: remarks.trim() || null,
            };
            const saved =
                mode === 'create'
                    ? await stockCountApi.create(payload)
                    : await stockCountApi.update(initial!.id, payload);
            router.push(`/inventory/stock_count/${saved.id}/view`);
            router.refresh();
        } catch (e) {
            const message = e instanceof Error ? e.message : 'Failed to save stock count';
            setError(message);
            toast.error(message);
            setSaving(false);
        }
    }

    return (
        <div className="space-y-4 font-mono text-xs">
            <div>
                <button
                    onClick={() => router.push('/inventory/stock_count')}
                    className="inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
                >
                    <ArrowLeftIcon size={16} /> Back
                </button>
                <h2 className="mt-3 flex items-center gap-2 text-2xl font-bold text-foreground md:text-3xl">
                    <ClipboardList className="text-success" />
                    {mode === 'create' ? 'New Stock Count' : `Edit ${initial?.count_no ?? 'Stock Count'}`}
                </h2>
                <p className="mt-1 text-muted-foreground">
                    Define the scope now — the snapshot is frozen later at Prepare, not on save.
                </p>
            </div>

            {error && (
                <div className="flex items-start gap-3 rounded-xl border border-danger/30 bg-danger-muted px-4 py-3">
                    <AlertCircle size={18} className="mt-0.5 shrink-0 text-danger" />
                    <p className="text-danger">{error}</p>
                    <button
                        type="button"
                        onClick={() => setError('')}
                        className="ml-auto shrink-0 text-danger/60 hover:text-danger"
                    >
                        <X size={16} />
                    </button>
                </div>
            )}

            <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
                <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Count Details
                </h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label className="text-xs">Count Date *</Label>
                        <Input
                            type="date"
                            value={countDate}
                            onChange={(e) => setCountDate(e.target.value)}
                            className="text-xs font-mono"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs">Count Mode *</Label>
                        <select
                            value={countMode}
                            onChange={(e) => setCountMode(e.target.value as StockCountMode)}
                            className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs font-mono outline-none focus:border-ring"
                        >
                            {(Object.keys(MODE_LABEL) as StockCountMode[]).map((m) => (
                                <option key={m} value={m}>
                                    {MODE_LABEL[m]}
                                </option>
                            ))}
                        </select>
                    </div>
                    <AsyncSearchSelect
                        label="Warehouse *"
                        placeholder="Select warehouse..."
                        apiUrl={API.inventory.warehouse.root}
                        value={warehouse.id}
                        selectedLabel={warehouse.name}
                        enablePopupSearch
                        onChangeAction={(s) => {
                            if (!s?.id) return;
                            setWarehouse({ id: Number(s.id), name: s.name });
                            // Location belongs to the old warehouse — clear it.
                            setLocation({ id: null, name: '' });
                        }}
                    />
                    <AsyncSearchSelect
                        label={countMode === 'location' ? 'Location *' : 'Location'}
                        placeholder={warehouse.id ? 'All locations' : 'Pick warehouse first'}
                        apiUrl={warehouse.id ? API.inventory.warehouse.locations(warehouse.id) : ''}
                        value={location.id}
                        selectedLabel={location.name}
                        enablePopupSearch
                        onChangeAction={(s) => {
                            if (!s?.id) {
                                setLocation({ id: null, name: '' });
                                return;
                            }
                            setLocation({ id: Number(s.id), name: s.name });
                        }}
                    />
                    {countMode === 'category' && (
                        <AsyncSearchSelect
                            label="Category *"
                            placeholder="Search category..."
                            apiUrl={API.inventory.category.root}
                            value={category.id}
                            selectedLabel={category.name}
                            enablePopupSearch
                            onChangeAction={(s) => {
                                if (!s?.id) return;
                                setCategory({ id: Number(s.id), name: s.name });
                            }}
                        />
                    )}
                    {countMode === 'items' && (
                        <AsyncSearchSelect
                            label="Item *"
                            placeholder="Search stock item..."
                            apiUrl={API.inventory.stockItem.root}
                            value={item.id}
                            selectedLabel={item.name}
                            enablePopupSearch
                            onChangeAction={(s) => {
                                if (!s?.id) return;
                                setItem({ id: Number(s.id), name: s.name });
                            }}
                        />
                    )}
                    <div className="space-y-1.5 md:col-span-2">
                        <Label className="text-xs">Remarks</Label>
                        <textarea
                            value={remarks ?? ''}
                            onChange={(e) => setRemarks(e.target.value)}
                            placeholder="Optional note"
                            rows={3}
                            className="w-full rounded-md border border-input bg-background px-2 py-2 text-xs font-mono outline-none focus:border-ring"
                        />
                    </div>
                </div>
            </section>

            <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => router.push('/inventory/stock_count')}>
                    Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={saving}>
                    {saving ? <Loader2Icon className="animate-spin" size={15} /> : <SaveIcon size={15} />}
                    {saving ? 'Saving…' : mode === 'create' ? 'Create Count' : 'Save Changes'}
                </Button>
            </div>
        </div>
    );
}
