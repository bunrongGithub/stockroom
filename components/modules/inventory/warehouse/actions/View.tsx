'use client';

import { Check } from '@/components/ui/Check';
import { useRegisterModule } from '@/hook/useModule';
import type { ModuleProps } from '@/lib/registry';
import type { Warehouse, WarehouseLocation } from '@/types/branch';
import {
  ArrowLeft,
  Loader2,
  MapPin,
  Pencil,
  Warehouse as WarehouseIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function View({
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
  const id = Number(
    Array.isArray(params.slug) ? params.slug.at(-2) : params.slug,
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [warehouse, setWarehouse] = useState<Warehouse | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/inventory/configurations/warehouse/${id}/view`)
      .then((r) => r.json())
      .then((json: Warehouse) => setWarehouse(json))
      .catch(() => setError('Failed to load warehouse.'))
      .finally(() => setLoading(false));
  }, [id]);

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

  if (!warehouse) return null;

  return (
    <div className="space-y-4 font-mono text-xs rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/inventory/configurations/warehouse"
            className="inline-flex items-center gap-1.5 text-slate-500 transition-colors hover:text-slate-700"
          >
            <ArrowLeft size={14} /> Back to Warehouses
          </Link>
          <h2 className="mt-2 flex items-center gap-2 text-xl font-bold text-slate-800">
            <WarehouseIcon className="text-emerald-500" size={20} />
            {warehouse.name}
          </h2>
        </div>
        {permission.can_update && (
          <Link
            href={`/inventory/configurations/warehouse/${id}/update`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-slate-600 transition-colors hover:bg-slate-50"
          >
            <Pencil size={13} /> Edit
          </Link>
        )}
      </div>

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
        <div className="grid gap-5 p-5 sm:grid-cols-2">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">
              Reference No
            </p>
            <p className="text-slate-800 font-medium">
              {warehouse.reference_no || '—'}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">
              Name
            </p>
            <p className="text-slate-800 font-medium">{warehouse.name}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">
              Phone
            </p>
            <p className="text-slate-800">{warehouse.phone || '—'}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">
              Address
            </p>
            <p className="text-slate-800">{warehouse.address || '—'}</p>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-slate-500">Active</span>
              <Check checked={warehouse.is_active} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500">Default</span>
              <Check checked={warehouse.is_default ?? false} />
            </div>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">
              Created
            </p>
            <p className="text-slate-500">
              {new Date(warehouse.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
      </section>

      {/* Locations */}
      <section className="rounded-xl border border-slate-100 overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50/80 px-5 py-3">
          <div className="flex items-center gap-2">
            <MapPin size={13} className="text-emerald-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Locations ({warehouse.warehouse_location?.length ?? 0})
            </h3>
          </div>
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
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {(warehouse.warehouse_location ?? []).length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-400">
                    No locations found.
                  </td>
                </tr>
              )}
              {(warehouse.warehouse_location ?? []).map(
                (loc: WarehouseLocation) => (
                  <tr key={loc.id} className="hover:bg-slate-50/50">
                    <td className="px-5 py-3 text-slate-800">{loc.name}</td>
                    <td className="px-5 py-3 text-slate-400">
                      {loc.code || '—'}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <Check checked={loc.is_default} />
                    </td>
                    <td className="px-5 py-3 text-center">
                      <Check checked={loc.is_active} />
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
