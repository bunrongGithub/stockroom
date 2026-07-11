'use client';

import {
    EditableInput,
    EditableTextarea,
    FieldLabel,
} from '@/components/ui/FieldLabel';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { uomApi } from '@/lib/api/uom';
import type { InventoryUom } from '@/service/apps/inventory/repo/uom';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function UomForm({
    mode,
    initial,
}: {
    mode: 'create' | 'edit';
    initial?: InventoryUom;
}) {
    const router = useRouter();
    const toast = useToast();

    const [code, setCode] = useState(initial?.code ?? '');
    const [name, setName] = useState(initial?.name ?? '');
    const [displayName, setDisplayName] = useState(initial?.display_name ?? '');
    const [description, setDescription] = useState(initial?.description ?? '');
    const [isActive, setIsActive] = useState(initial?.is_active ?? true);
    const [isDefault, setIsDefault] = useState(initial?.is_default ?? false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError('');
        if (!code.trim()) return setError('Code is required');
        if (!name.trim()) return setError('Name is required');
        if (!displayName.trim()) return setError('Symbol is required');

        setSaving(true);
        try {
            const payload = {
                code: code.trim(),
                name: name.trim(),
                display_name: displayName.trim(),
                description: description.trim() || undefined,
                is_active: isActive,
                is_default: isDefault,
            };
            const saved =
                mode === 'create'
                    ? await uomApi.create(payload)
                    : await uomApi.update(initial!.id, payload);
            toast.success(
                `Unit ${saved.code} ${mode === 'create' ? 'created' : 'updated'}.`,
            );
            router.push(`/inventory/configurations/uom/${saved.id}/view`);
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save');
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="mx-auto max-w-2xl space-y-4">
            <button
                type="button"
                onClick={() => router.push('/inventory/configurations/uom')}
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
                <ArrowLeft size={16} /> Back to Units of Measure
            </button>

            <PageHeader
                title={mode === 'create' ? 'New Unit of Measure' : `Edit ${initial?.code}`}
                description="Master unit used across inventory items and transactions."
            />

            {error && (
                <div className="rounded-xl border border-danger/30 bg-danger-muted px-4 py-3 text-sm text-danger">
                    {error}
                </div>
            )}

            <form
                onSubmit={handleSubmit}
                className="space-y-5 rounded-2xl border border-border/60 bg-card p-5 shadow-sm"
            >
                <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                        <FieldLabel required>Code</FieldLabel>
                        <EditableInput
                            value={code}
                            onChange={(e) => setCode(e.target.value.toUpperCase())}
                            placeholder="e.g. PCS, KG, BOX"
                            maxLength={20}
                            autoFocus
                        />
                        <p className="mt-1 text-xs text-muted-foreground">
                            Unique business code (auto-uppercased).
                        </p>
                    </div>
                    <div>
                        <FieldLabel required>Symbol</FieldLabel>
                        <EditableInput
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            placeholder="e.g. pcs, kg, box"
                            maxLength={20}
                        />
                        <p className="mt-1 text-xs text-muted-foreground">
                            Shown on documents (max 20 chars).
                        </p>
                    </div>
                </div>

                <div>
                    <FieldLabel required>Name</FieldLabel>
                    <EditableInput
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Pieces, Kilogram, Box"
                    />
                </div>

                <div>
                    <FieldLabel>Description</FieldLabel>
                    <EditableTextarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Optional notes about this unit"
                        rows={3}
                    />
                </div>

                <div className="flex flex-col gap-4 border-t border-border/40 pt-4 sm:flex-row sm:gap-8">
                    <label className="flex items-center gap-3">
                        <Switch
                            checked={isActive}
                            onCheckedChange={(v) => setIsActive(v)}
                        />
                        <span className="text-sm">
                            <span className="font-medium">Active</span>
                            <span className="block text-xs text-muted-foreground">
                                Inactive units can't be used on new transactions.
                            </span>
                        </span>
                    </label>
                    <label className="flex items-center gap-3">
                        <Switch
                            checked={isDefault}
                            onCheckedChange={(v) => setIsDefault(v)}
                        />
                        <span className="text-sm">
                            <span className="font-medium">Default unit</span>
                            <span className="block text-xs text-muted-foreground">
                                Auto-selected where appropriate (one per company).
                            </span>
                        </span>
                    </label>
                </div>

                <div className="flex flex-col-reverse gap-2 border-t border-border/40 pt-4 sm:flex-row sm:justify-end">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                            router.push('/inventory/configurations/uom')
                        }
                    >
                        Cancel
                    </Button>
                    <Button type="submit" disabled={saving}>
                        {saving && <Spinner size={15} className="text-current" />}
                        {mode === 'create' ? 'Create UOM' : 'Save Changes'}
                    </Button>
                </div>
            </form>
        </div>
    );
}
