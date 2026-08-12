'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldLabel } from '@/components/ui/FieldLabel';
import {
    FieldGrid,
    FormLayout,
    SectionCard,
    SidebarCard,
    SummaryRow,
} from '@/components/ui/FormShell';
import { PAGE_ACTION_CLASS, PageHeader } from '@/components/ui/PageHeader';
import { LoadingState, Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
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
import {
    Barcode,
    FileWarning,
    Hash,
    RotateCcw,
    Save,
    Sparkles,
} from 'lucide-react';
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

const RESET_RULES: { value: SerialResetRule; label: string; hint: string }[] = [
    { value: 'never', label: 'Never Reset', hint: 'One running count forever.' },
    { value: 'yearly', label: 'Yearly', hint: 'The counter restarts each January.' },
    { value: 'monthly', label: 'Monthly', hint: 'The counter restarts each month.' },
    { value: 'daily', label: 'Daily', hint: 'The counter restarts each day.' },
];

/**
 * What each strategy means for the counter — the part that is not obvious from
 * the example alone, since it decides whether numbers are shared or per-entity.
 */
const STRATEGY_NOTE: Record<SerialStrategy, string> = {
    sequential:
        'One company-wide counter. Every serial continues the same sequence regardless of item or warehouse.',
    date_prefix:
        'The issue date leads the serial, followed by the counter — useful when serials are filed by day.',
    item_prefix:
        'Each item keeps its own counter, so two different items can both hold serial 000001.',
    warehouse_prefix:
        'Each warehouse keeps its own counter, so a serial identifies where it was received.',
    company_prefix:
        'One company-wide counter behind a fixed company code — the code identifies you, not the item.',
    random:
        'No counter at all: each serial is drawn at random, so they cannot be guessed or ordered.',
    custom: '',
};

/** Sample context for the preview — the same shape the generator receives. */
const PREVIEW_CONTEXT = {
    itemCode: 'IP16',
    warehouseCode: 'WH01',
    companyCode: 'ICASE',
};

/**
 * Serial Number Configuration — company-wide generation settings the Serial
 * Management framework reads on every Generate. The preview renders through
 * the SAME pure strategy engine the server uses, so what you see is exactly
 * what will be generated.
 *
 * Laid out with the shared document shell (PageHeader + FormLayout): the
 * settings occupy the full page width in sectioned cards, and the sticky
 * sidebar keeps the live preview visible while you edit the fields that drive
 * it — the one thing you actually want to watch on this screen.
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

    const toast = useToast();
    const [cfg, setCfg] = useState<SerialGenerationConfig | null>(null);
    const [saving, setSaving] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch(API.inventory.serialSetting);
                const json = await res.json();
                if (!res.ok) throw new Error(json.error ?? 'Failed to load');
                if (!cancelled) setCfg(json.data);
            } catch (e) {
                if (!cancelled)
                    setLoadError(e instanceof Error ? e.message : 'Failed to load');
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const preview = useMemo(() => {
        if (!cfg) return [];
        try {
            return renderSerials(cfg, 3, cfg.start_number, PREVIEW_CONTEXT);
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
            toast.success('Serial numbering saved.');
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Save failed');
        } finally {
            setSaving(false);
        }
    };

    if (loadError) {
        return (
            <div className="space-y-4 font-mono">
                <PageHeader
                    title="Serial Numbering"
                    description="How serial numbers are generated across receipts, adjustments and future modules."
                />
                <EmptyState
                    icon={FileWarning}
                    title="Could not load serial settings"
                    description={loadError}
                />
            </div>
        );
    }

    if (!cfg) return <LoadingState label="Loading serial settings…" />;

    const strategy = STRATEGIES.find((s) => s.value === cfg.strategy);
    const resetRule = RESET_RULES.find((r) => r.value === cfg.reset_rule);
    const readOnly = !permission.can_update;
    // A custom pattern with nothing in it would generate empty serials.
    const incomplete = cfg.strategy === 'custom' && !cfg.pattern?.trim();

    return (
        <div className="animate-in fade-in space-y-4 font-mono duration-300">
            <PageHeader
                title="Serial Numbering"
                description="How serial numbers are generated across receipts, adjustments and future modules."
                actions={
                    permission.can_update && (
                        <Button
                            className={PAGE_ACTION_CLASS}
                            onClick={save}
                            disabled={saving || incomplete}
                        >
                            {saving ? <Spinner size={15} className="text-current" /> : <Save size={15} />}
                            Save settings
                        </Button>
                    )
                }
            />

            <FormLayout
                sidebar={
                    <>
                        <SidebarCard icon={<Sparkles size={13} />} title="Live Preview">
                            {preview.length ? (
                                <div className="space-y-1.5">
                                    {preview.map((sn, i) => (
                                        <div
                                            key={`${sn}-${i}`}
                                            className="rounded-lg border border-success/30 bg-success-muted px-3 py-2 text-center text-sm font-semibold text-success tnums"
                                        >
                                            {sn}
                                        </div>
                                    ))}
                                    <p className="pt-1 text-center text-[10px] text-muted-foreground">
                                        The next three serials this configuration
                                        would generate.
                                    </p>
                                </div>
                            ) : (
                                <p className="py-2 text-center text-xs text-muted-foreground">
                                    Enter a valid pattern to see a preview.
                                </p>
                            )}
                        </SidebarCard>

                        <SidebarCard icon={<Barcode size={13} />} title="Summary">
                            <div className="space-y-2 text-xs">
                                <SummaryRow label="Strategy">
                                    {strategy?.label ?? cfg.strategy}
                                </SummaryRow>
                                <SummaryRow label="Prefix">
                                    {cfg.prefix || '—'}
                                </SummaryRow>
                                <SummaryRow label="Suffix">
                                    {cfg.suffix || '—'}
                                </SummaryRow>
                                <SummaryRow label="Number length">
                                    {cfg.seq_length}
                                </SummaryRow>
                                <SummaryRow label="Starts at">
                                    {cfg.start_number}
                                </SummaryRow>
                                <SummaryRow label="Resets">
                                    {resetRule?.label ?? cfg.reset_rule}
                                </SummaryRow>
                            </div>
                        </SidebarCard>
                    </>
                }
            >
                <div className="space-y-5">
                    <SectionCard
                        icon={<Barcode size={13} />}
                        title="Generation Strategy"
                    >
                        <FieldGrid>
                            <div>
                                <FieldLabel>Default strategy</FieldLabel>
                                <Select
                                    value={cfg.strategy}
                                    onValueChange={(v) => set('strategy', v as SerialStrategy)}
                                    disabled={readOnly}
                                >
                                    <SelectTrigger className="w-full">
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
                                {strategy && (
                                    <p className="mt-1.5 text-xs text-muted-foreground">
                                        Example: {strategy.hint}
                                    </p>
                                )}
                            </div>

                            {/* The second cell is the strategy's own
                                explanation, so the card fills its width whether
                                or not the custom-pattern field is showing. */}
                            {cfg.strategy === 'custom' ? (
                                <div>
                                    <FieldLabel required>Custom pattern</FieldLabel>
                                    <Input
                                        value={cfg.pattern ?? ''}
                                        onChange={(e) => set('pattern', e.target.value)}
                                        placeholder="{PREFIX}{YYYY}{MM}-{SEQ}{SUFFIX}"
                                        disabled={readOnly}
                                    />
                                    <p className="mt-1.5 text-xs text-muted-foreground">
                                        Tokens:{' '}
                                        {'{PREFIX} {SUFFIX} {SEQ} {YYYY} {YY} {MM} {DD} {ITEM} {WH} {COMPANY} {RAND}'}
                                    </p>
                                </div>
                            ) : (
                                <div className="rounded-xl border border-border/60 bg-muted/30 p-4 text-xs text-muted-foreground">
                                    {STRATEGY_NOTE[cfg.strategy]}
                                </div>
                            )}
                        </FieldGrid>
                    </SectionCard>

                    <SectionCard icon={<Hash size={13} />} title="Number Format">
                        <FieldGrid cols={4}>
                            <div>
                                <FieldLabel>Prefix</FieldLabel>
                                <Input
                                    value={cfg.prefix}
                                    maxLength={20}
                                    onChange={(e) => set('prefix', e.target.value)}
                                    disabled={readOnly}
                                />
                            </div>
                            <div>
                                <FieldLabel>Suffix</FieldLabel>
                                <Input
                                    value={cfg.suffix}
                                    maxLength={20}
                                    onChange={(e) => set('suffix', e.target.value)}
                                    disabled={readOnly}
                                />
                            </div>
                            <div>
                                <FieldLabel>Number length (padding)</FieldLabel>
                                <Input
                                    type="number"
                                    min={1}
                                    max={20}
                                    value={cfg.seq_length}
                                    onChange={(e) =>
                                        set('seq_length', Math.max(1, Math.min(20, Number(e.target.value) || 1)))
                                    }
                                    disabled={readOnly}
                                />
                            </div>
                            <div>
                                <FieldLabel>Starting number</FieldLabel>
                                <Input
                                    type="number"
                                    min={1}
                                    value={cfg.start_number}
                                    onChange={(e) =>
                                        set('start_number', Math.max(1, Number(e.target.value) || 1))
                                    }
                                    disabled={readOnly}
                                />
                            </div>
                        </FieldGrid>
                    </SectionCard>

                    <SectionCard icon={<RotateCcw size={13} />} title="Sequence Reset">
                        <FieldGrid>
                            <div>
                                <FieldLabel>Reset rule</FieldLabel>
                                <Select
                                    value={cfg.reset_rule}
                                    onValueChange={(v) => set('reset_rule', v as SerialResetRule)}
                                    disabled={readOnly}
                                >
                                    <SelectTrigger className="w-full">
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
                                {resetRule && (
                                    <p className="mt-1.5 text-xs text-muted-foreground">
                                        {resetRule.hint}
                                    </p>
                                )}
                            </div>
                            <div className="rounded-xl border border-border/60 bg-muted/30 p-4 text-xs text-muted-foreground">
                                Each period keeps its own sequence, so a reset
                                never reuses a serial already issued in an
                                earlier period.
                            </div>
                        </FieldGrid>
                    </SectionCard>

                    {readOnly && (
                        <p className="text-xs text-muted-foreground">
                            You have view-only access to serial numbering.
                        </p>
                    )}
                </div>
            </FormLayout>
        </div>
    );
}
