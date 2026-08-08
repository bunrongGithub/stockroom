'use client';

import { Button } from '@/components/ui/button';
import { EditableSelect, FieldLabel } from '@/components/ui/FieldLabel';
import { SectionCard } from '@/components/ui/FormShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { useRegisterModule } from '@/hook/useModule';
import { cashSaleApi, type SalesSettings } from '@/lib/api/cash-sale';
import { API } from '@/lib/constant';
import type { ModuleProps } from '@/lib/registry';
import { Loader2, Settings, Warehouse } from 'lucide-react';
import { useEffect, useState } from 'react';

type Option = { id: number; name: string };

/**
 * Sales Settings — where counter sales ship from.
 *
 * The Cash Sale register takes its warehouse and location from here, so no
 * warehouse is ever hardcoded and a company with several outlets only changes
 * this screen.
 */
export default function SaleSettingModule({
    currentPath,
    permission,
    currentPathActions,
}: ModuleProps) {
    useRegisterModule({
        actionModules: currentPathActions,
        permission,
        modulePath: currentPath.path,
    });

    const [settings, setSettings] = useState<SalesSettings | null>(null);
    const [warehouses, setWarehouses] = useState<Option[]>([]);
    const [locations, setLocations] = useState<Option[]>([]);
    const [warehouseId, setWarehouseId] = useState<number | null>(null);
    const [locationId, setLocationId] = useState<number | null>(null);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            try {
                const [s, whRes] = await Promise.all([
                    cashSaleApi.settings(),
                    fetch(`${API.inventory.warehouse.root}?limit=100`).then(
                        (r) => r.json(),
                    ),
                ]);
                setSettings(s);
                setWarehouseId(s.default_sales_warehouse_id);
                setLocationId(s.default_sales_location_id);
                setWarehouses(whRes.data ?? []);
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Failed to load');
            }
        })();
    }, []);

    // Locations belong to a warehouse: changing the warehouse reloads them and
    // drops a location that no longer applies.
    useEffect(() => {
        if (!warehouseId) return;
        fetch(API.inventory.warehouse.locations(warehouseId))
            .then((r) => r.json())
            .then((json) => {
                const rows: Option[] = json.data ?? [];
                setLocations(rows);
                setLocationId((current) =>
                    rows.some((l) => l.id === current) ? current : null,
                );
            })
            .catch(() => setLocations([]));
    }, [warehouseId]);

    const save = async () => {
        setSaving(true);
        setError(null);
        setMessage(null);
        try {
            const updated = await cashSaleApi.updateSettings({
                default_sales_warehouse_id: warehouseId,
                default_sales_location_id: locationId,
            });
            setSettings(updated);
            setMessage('Sales settings saved');
            setTimeout(() => setMessage(null), 3000);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Save failed');
        } finally {
            setSaving(false);
        }
    };

    if (!settings && !error) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loader2 className="animate-spin text-emerald-500" size={24} />
            </div>
        );
    }

    return (
        <div className="animate-in fade-in space-y-4 font-mono text-xs duration-300">
            <PageHeader
                title="Sales Settings"
                description="Where counter sales take stock from."
            />

            <SectionCard
                icon={<Warehouse size={13} />}
                title="Cash Sale source"
            >
              <div className="max-w-xl space-y-4">
                <div>
                    <FieldLabel>Default sales warehouse</FieldLabel>
                    <EditableSelect
                        value={warehouseId ? String(warehouseId) : ''}
                        onChange={(e) => {
                            // A location from the old warehouse cannot apply.
                            setLocations([]);
                            setLocationId(null);
                            setWarehouseId(Number(e.target.value));
                        }}
                        disabled={!permission.can_update}
                    >
                        <option value="" disabled>
                            Select a warehouse
                        </option>
                        {warehouses.map((w) => (
                            <option key={w.id} value={String(w.id)}>
                                {w.name}
                            </option>
                        ))}
                    </EditableSelect>
                </div>

                <div>
                    <FieldLabel>Default sales location</FieldLabel>
                    <EditableSelect
                        value={locationId ? String(locationId) : ''}
                        onChange={(e) => setLocationId(Number(e.target.value))}
                        disabled={!permission.can_update || !warehouseId}
                    >
                        <option value="" disabled>
                            Select a location
                        </option>
                        {locations.map((l) => (
                            <option key={l.id} value={String(l.id)}>
                                {l.name}
                            </option>
                        ))}
                    </EditableSelect>
                </div>

                {error && (
                    <p className="rounded-xl bg-rose-50 px-3 py-2 text-rose-600">
                        {error}
                    </p>
                )}
                {message && (
                    <p className="rounded-xl bg-emerald-50 px-3 py-2 text-emerald-700">
                        {message}
                    </p>
                )}

                {permission.can_update && (
                    <Button
                        onClick={save}
                        disabled={saving || !warehouseId}
                        className="gap-1.5 bg-emerald-600 hover:bg-emerald-500"
                    >
                        {saving ? (
                            <Loader2 size={14} className="animate-spin" />
                        ) : (
                            <Settings size={14} />
                        )}
                        Save settings
                    </Button>
                )}
              </div>
            </SectionCard>
        </div>
    );
}
