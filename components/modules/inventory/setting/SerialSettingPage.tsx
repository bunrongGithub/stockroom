'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/ui/PageHeader';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useRegisterModule } from '@/hook/useModule';
import { API } from '@/lib/constant';
import type { ModuleProps } from '@/lib/registry';
import {
    renderSerials,
    type SerialGenerationConfig,
    type SerialResetRule,
    type SerialStrategy,
} from '@/service/apps/inventory/serial/strategies';
import { Barcode, Loader2, Settings } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

const STRATEGIES: { value: SerialStrategy; label: string; hint: string }[] = [
    { value: 'sequential', label: 'Sequential Number', hint: '00000001, 00000002, …' },
    { value: 'date_prefix', label: 'Date Prefix', hint: '202607180001' },
    { value: 'item_prefix', label: 'Item Prefix', hint: 'IP16-000001 (per-item counter)' },
    { value: 'warehouse_prefix', label: 'Warehouse Prefix', hint: 'WH01-000001 (per-warehouse counter)' },
    { value: 'company_prefix', label: 'Company Prefix', hint: 'ICASE-000001' },
    { value: 'random', label: 'Random Alphanumeric', hint: 'A92XK01P (no sequence)' },
    { value: 'custom', label: 'Custom Pattern', hint: 'Token template, e.g. {PREFIX}{YY}{MM}-{SEQ}' },
];

const RESET_RULES: { value: SerialResetRule; label: string }[] = [
    { value: 'never', label: 'Never Reset' },
    { value: 'yearly', label: 'Yearly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'daily', label: 'Daily' },
];

/**
 * Serial Number Configuration — company-wide generation settings the Serial
 * Management framework reads on every Generate. The preview renders through
 * the SAME pure strategy engine the server uses, so what you see is exactly
 * what will be generated.
 */
export default function SerialSettingPage({
    currentPath,
    permission,
    currentPathActions,
}: ModuleProps) {
    useRegisterModule({
        actionModules: currentPathActions,
        permission,
        modulePath: currentPath.path,
    });

    const [cfg, setCfg] = useState<SerialGenerationConfig | null>(null);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(API.inventory.serialSetting);
                const json = await res.json();
                if (!res.ok) throw new Error(json.error ?? 'Failed to load');
                setCfg(json.data);
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Failed to load');
            }
        })();
    }, []);

    const preview = useMemo(() => {
        if (!cfg) return [];
        try {
            return renderSerials(cfg, 3, cfg.start_number, {
                itemCode: 'IP16',
                warehouseCode: 'WH01',
                companyCode: 'ICASE',
            });
        } catch {
            return [];
        }
    }, [cfg]);

    function set<K extends keyof SerialGenerationConfig>(
        key: K,
        val: SerialGenerationConfig[K],
    ) {
        setCfg((c) => (c ? { ...c, [key]: val } : c));
    }

    const save = async () => {
        if (!cfg) return;
        setSaving(true);
        setError(null);
        setMessage(null);
        try {
            const res = await fetch(API.inventory.serialSetting, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    strategy: cfg.strategy,
                    prefix: cfg.prefix,
                    suffix: cfg.suffix,
                    seq_length: cfg.seq_length,
                    start_number: cfg.start_number,
                    reset_rule: cfg.reset_rule,
                    pattern: cfg.strategy === 'custom' ? cfg.pattern : null,
                }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error ?? 'Save failed');
            setCfg(json.data);
            setMessage('Serial numbering saved');
            setTimeout(() => setMessage(null), 3000);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Save failed');
        } finally {
            setSaving(false);
        }
    };

    if (!cfg && !error) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loader2 className="animate-spin text-emerald-500" size={24} />
            </div>
        );
    }

    const strategyHint = STRATEGIES.find((s) => s.value === cfg?.strategy)?.hint;

    return (
        <div className="animate-in fade-in space-y-4 font-mono text-xs duration-300">
            <PageHeader
                title="Serial Numbering"
                description="How serial numbers are generated across receipts, adjustments and future modules."
            />

            <div className="max-w-xl space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <Barcode size={16} className="text-[#1a9e52]" />
                    Generation strategy
                </h2>

                {cfg && (
                    <>
                        <div className="space-y-1.5">
                            <Label>Default strategy</Label>
                            <Select
                                value={cfg.strategy}
                                onValueChange={(v) => set('strategy', v as SerialStrategy)}
                                disabled={!permission.can_update}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {STRATEGIES.map((s) => (
                                        <SelectItem key={s.value} value={s.value}>
                                            {s.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {strategyHint && (
                                <p className="text-[10px] text-slate-400">{strategyHint}</p>
                            )}
                        </div>

                        {cfg.strategy === 'custom' && (
                            <div className="space-y-1.5">
                                <Label>Custom pattern</Label>
                                <Input
                                    value={cfg.pattern ?? ''}
                                    onChange={(e) => set('pattern', e.target.value)}
                                    placeholder="{PREFIX}{YYYY}{MM}-{SEQ}{SUFFIX}"
                                    disabled={!permission.can_update}
                                />
                                <p className="text-[10px] text-slate-400">
                                    Tokens: {'{PREFIX} {SUFFIX} {SEQ} {YYYY} {YY} {MM} {DD} {ITEM} {WH} {COMPANY} {RAND}'}
                                </p>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label>Prefix</Label>
                                <Input
                                    value={cfg.prefix}
                                    maxLength={20}
                                    onChange={(e) => set('prefix', e.target.value)}
                                    disabled={!permission.can_update}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Suffix</Label>
                                <Input
                                    value={cfg.suffix}
                                    maxLength={20}
                                    onChange={(e) => set('suffix', e.target.value)}
                                    disabled={!permission.can_update}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Number length (padding)</Label>
                                <Input
                                    type="number"
                                    min={1}
                                    max={20}
                                    value={cfg.seq_length}
                                    onChange={(e) =>
                                        set('seq_length', Math.max(1, Math.min(20, Number(e.target.value) || 1)))
                                    }
                                    disabled={!permission.can_update}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Starting number</Label>
                                <Input
                                    type="number"
                                    min={1}
                                    value={cfg.start_number}
                                    onChange={(e) =>
                                        set('start_number', Math.max(1, Number(e.target.value) || 1))
                                    }
                                    disabled={!permission.can_update}
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label>Reset rule</Label>
                            <Select
                                value={cfg.reset_rule}
                                onValueChange={(v) => set('reset_rule', v as SerialResetRule)}
                                disabled={!permission.can_update}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {RESET_RULES.map((r) => (
                                        <SelectItem key={r.value} value={r.value}>
                                            {r.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-[10px] text-slate-400">
                                The counter starts over per year / month / day — each period keeps its own sequence.
                            </p>
                        </div>

                        {/* Live preview through the real strategy engine */}
                        <div className="rounded-xl border border-dashed border-emerald-200 bg-emerald-50/40 p-3">
                            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                Preview
                            </p>
                            {preview.length ? (
                                <div className="flex flex-wrap gap-1.5">
                                    {preview.map((sn, i) => (
                                        <span
                                            key={`${sn}-${i}`}
                                            className="rounded-md border border-emerald-200 bg-white px-1.5 py-0.5 font-mono text-[11px] text-emerald-800"
                                        >
                                            {sn}
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-[11px] text-slate-400">
                                    Enter a valid pattern to see a preview.
                                </p>
                            )}
                        </div>
                    </>
                )}

                {error && (
                    <p className="rounded-xl bg-rose-50 px-3 py-2 text-rose-600">{error}</p>
                )}
                {message && (
                    <p className="rounded-xl bg-emerald-50 px-3 py-2 text-emerald-700">{message}</p>
                )}

                {permission.can_update && cfg && (
                    <Button
                        onClick={save}
                        disabled={saving || (cfg.strategy === 'custom' && !cfg.pattern?.trim())}
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
        </div>
    );
}
