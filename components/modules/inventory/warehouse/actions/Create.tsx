'use client';

import { Check } from '@/components/ui/Check';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useRegisterModule } from '@/hook/useModule';
import type { ModuleProps } from '@/lib/registry';
import {
  ArrowLeft,
  Loader2,
  Save,
  Warehouse as WarehouseIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function Create({
  currentPath,
  permission,
  currentPathActions,
}: ModuleProps) {
  useRegisterModule({
    actionModules: currentPathActions,
    permission,
    modulePath: currentPath.path,
  });

  const router = useRouter();

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [referenceNo, setReferenceNo] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  const baseURL = `/api/inventory/configurations/warehouse/create`;
  const handleSave = async () => {
    if (!name.trim()) {
      setSaveError('Warehouse name is required.');
      return;
    }
    if (!referenceNo.trim()) {
      setSaveError('Reference No is required.');
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      const res = await fetch(baseURL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          reference_no: referenceNo.trim(),
          code: code.trim() || null,
          address: address.trim() || null,
          phone: phone.trim() || null,
          is_default: isDefault,
        }),
      });
      console.log;
      if (!res.ok) {
        const j = await res.json();
        setSaveError(j.error ?? 'Failed to create warehouse.');
        return;
      }

      router.push('/inventory/configurations/warehouse');
    } catch (error) {
      console.log(error);
      setSaveError('An unexpected error occurred.');
    } finally {
      setSaving(false);
    }
  };

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
            New Warehouse
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/inventory/configurations/warehouse"
            className="rounded-lg border border-slate-200 px-4 py-2 text-slate-600 transition-colors hover:bg-slate-50"
          >
            Cancel
          </Link>
          <Button onClick={handleSave} disabled={saving} size="sm">
            {saving ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Save size={13} />
            )}
            {saving ? 'Saving...' : 'Save'}
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
            <Label htmlFor="ref-no">
              Reference No <span className="text-red-500">*</span>
            </Label>
            <Input
              id="ref-no"
              value={referenceNo}
              onChange={(e) => setReferenceNo(e.target.value)}
              placeholder="e.g. WH-001"
            />
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
            <Label htmlFor="wh-code">Code</Label>
            <Input
              id="wh-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. WP-0001"
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
          <div className="flex items-center gap-2">
            <span className="text-slate-600">Set as Default</span>
            <Check
              checked={isDefault}
              onChange={() => setIsDefault((v) => !v)}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
