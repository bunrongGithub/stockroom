'use client';

import { Check } from '@/components/ui/Check';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useRegisterModule } from '@/hook/useModule';
import type { ModuleProps } from '@/lib/registry';
import type { Warehouse, WarehouseLocation } from '@/types/branch';
import {
  ArrowLeft,
  Loader2,
  MapPin,
  Plus,
  Save,
  Trash2,
  Warehouse as WarehouseIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type LocationRow = {
  id?: number;
  name: string;
  code: string;
  description: string;
  is_active: boolean;
  is_default: boolean;
};

export default function Update({
  currentPath,
  permission,
  currentPathActions,
}: ModuleProps) {
  useRegisterModule({
    actionModules: currentPathActions,
    permission,
    modulePath: currentPath.path,
  });

  const params = useParams();
  const router = useRouter();
  const id = Number(
    Array.isArray(params.slug) ? params.slug.at(-2) : params.slug,
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saveError, setSaveError] = useState('');

  const [referenceNo, setReferenceNo] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isDefault, setIsDefault] = useState(false);

  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [removedIds, setRemovedIds] = useState<number[]>([]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/inventory/configurations/warehouse/${id}/update`)
      .then((r) => r.json())
      .then((json: Warehouse) => {
        setReferenceNo(json.reference_no ?? '');
        setName(json.name ?? '');
        setAddress(json.address ?? '');
        setPhone(json.phone ?? '');
        setIsActive(json.is_active ?? true);
        setIsDefault(json.is_default ?? false);
        setLocations(
          (json.warehouse_location ?? []).map((l: WarehouseLocation) => ({
            id: l.id,
            name: l.name,
            code: l.code ?? '',
            description: l.description ?? '',
            is_active: l.is_active,
            is_default: l.is_default,
          })),
        );
      })
      .catch(() => setError('Failed to load warehouse.'))
      .finally(() => setLoading(false));
  }, [id]);

  const addLocation = () => {
    setLocations((prev) => [
      ...prev,
      { name: '', code: '', description: '', is_active: true, is_default: false },
    ]);
  };

  const updateLocation = (
    index: number,
    field: keyof LocationRow,
    value: string | boolean,
  ) => {
    setLocations((prev) =>
      prev.map((l, i) => (i === index ? { ...l, [field]: value } : l)),
    );
  };

  const removeLocation = (index: number) => {
    const loc = locations[index];
    if (loc.id) setRemovedIds((prev) => [...prev, loc.id!]);
    setLocations((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setSaveError('Warehouse name is required.');
      return;
    }
    if (locations.some((l) => !l.name.trim())) {
      setSaveError('All location names are required.');
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      const res = await fetch(
        `/api/inventory/configurations/warehouse/${id}/update`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            address: address.trim() || null,
            phone: phone.trim() || null,
            is_active: isActive,
            is_default: isDefault,
            locations: locations.map((l) => ({
              id: l.id,
              name: l.name.trim(),
              code: l.code.trim() || null,
              description: l.description.trim() || null,
              is_active: l.is_active,
              is_default: l.is_default,
            })),
            removed_location_ids: removedIds,
          }),
        },
      );
      if (!res.ok) {
        const j = await res.json();
        setSaveError(j.error ?? 'Failed to save warehouse.');
        return;
      }
      router.push(`/inventory/configurations/warehouse/${id}/view`);
    } catch {
      setSaveError('An unexpected error occurred.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <Loader2 size={18} className="animate-spin mr-2" /> Loading...
      </div>
    );
  }

  if (error) {
    return <p className="py-10 text-center text-red-500">{error}</p>;
  }

  return (
    <div className="space-y-4 font-mono text-xs rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href={`/inventory/configurations/warehouse/${id}/view`}
            className="inline-flex items-center gap-1.5 text-slate-500 transition-colors hover:text-slate-700"
          >
            <ArrowLeft size={14} /> Back
          </Link>
          <h2 className="mt-2 flex items-center gap-2 text-xl font-bold text-slate-800">
            <WarehouseIcon className="text-emerald-500" size={20} />
            Update
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/inventory/configurations/warehouse/${id}/view`}
            className="rounded-lg border border-slate-200 px-4 py-2 text-slate-600 transition-colors hover:bg-slate-50"
          >
            Discard
          </Link>
          <Button onClick={handleSave} disabled={saving} size="sm">
            {saving ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Save size={13} />
            )}
            {saving ? 'Saving' : 'Save'}
          </Button>
        </div>
      </div>

      {saveError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          {saveError}
        </div>
      )}

      {/* Warehouse Info */}
      <section className="rounded-xl border border-slate-100 overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50/80 px-5 py-3">
          <div className="flex items-center gap-2">
            <WarehouseIcon size={13} className="text-emerald-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Warehouse Info
            </h3>
          </div>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="ref-no">Reference No</Label>
            <Input id="ref-no" value={referenceNo} readOnly className="bg-slate-50" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wh-name">
              Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="wh-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Warehouse name"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wh-phone">Phone</Label>
            <Input
              id="wh-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone number"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="wh-address">Address</Label>
            <Textarea
              id="wh-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Warehouse address"
              rows={2}
            />
          </div>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-slate-600">Active</span>
              <Check checked={isActive} onChange={() => setIsActive((v) => !v)} />
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-slate-600">Default</span>
              <Check
                checked={isDefault}
                onChange={() => setIsDefault((v) => !v)}
              />
            </label>
          </div>
        </div>
      </section>

      {/* Locations */}
      <section className="rounded-xl border border-slate-100 overflow-hidden">
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 bg-slate-50/80 px-5 py-3">
          <div className="flex items-center gap-2">
            <MapPin size={13} className="text-emerald-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Locations ({locations.length})
            </h3>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={addLocation}>
            <Plus size={13} /> Add Location
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Name
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Code
                </th>
                <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Default
                </th>
                <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Active
                </th>
                <th className="w-10 px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {locations.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    No locations. Click &quot;Add Location&quot; to add one.
                  </td>
                </tr>
              )}
              {locations.map((loc, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50">
                  <td className="px-5 py-2">
                    <Input
                      value={loc.name}
                      onChange={(e) =>
                        updateLocation(idx, 'name', e.target.value)
                      }
                      placeholder="Location name"
                      className="h-7"
                    />
                  </td>
                  <td className="px-5 py-2">
                    <Input
                      value={loc.code}
                      onChange={(e) =>
                        updateLocation(idx, 'code', e.target.value)
                      }
                      placeholder="Code"
                      className="h-7 w-28"
                    />
                  </td>
                  <td className="px-5 py-2 text-center">
                    <Check
                      checked={loc.is_default}
                      onChange={() =>
                        updateLocation(idx, 'is_default', !loc.is_default)
                      }
                    />
                  </td>
                  <td className="px-5 py-2 text-center">
                    <Check
                      checked={loc.is_active}
                      onChange={() =>
                        updateLocation(idx, 'is_active', !loc.is_active)
                      }
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => removeLocation(idx)}
                      className="text-slate-300 transition-colors hover:text-red-400"
                      title="Remove"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
