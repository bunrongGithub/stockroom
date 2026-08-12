'use client';

import { useMemo, useState } from 'react';
import { Check, Hash, Loader2, Pencil, X } from 'lucide-react';

import { FormHeader, HeaderAction, SectionCard } from '@/components/ui/FormShell';
import { EditableInput, EditableSelect, FieldLabel } from '@/components/ui/FieldLabel';
import {
    DataTable,
    type DataTableColumn,
    type DataTableFilterDef,
} from '@/components/ui/DataTable';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { RowAction, RowActions } from '@/components/ui/button-action';
import { useToast } from '@/components/ui/Toast';
import { useTableQuery } from '@/hook/useTableQuery';
import {
    FORMAT_PRESETS,
    DOCUMENT_RESET_RULES,
    effectiveNextValue,
    renderDocumentNumber,
    resetRuleIssue,
    validateDocumentFormat,
    type DocumentResetRule,
} from '@/service/core/document-format';

/** One configurable sequence, as the API returns it. */
type Sequence = {
    id: number;
    doc_type: string;
    label: string;
    group: string;
    prefix: string;
    format: string;
    padding: number;
    reset_rule: DocumentResetRule;
    is_active: boolean;
    next_value: number;
    period_key: string;
    preview: string;
    last_issued: string | null;
};

/** The fields the wizard edits. */
type Draft = Pick<
    Sequence,
    'prefix' | 'format' | 'padding' | 'reset_rule' | 'is_active'
>;

const API = '/api/setting/document-sequence';

const RESET_LABELS: Record<DocumentResetRule, string> = {
    never: 'Never — one running count forever',
    yearly: 'Yearly — restarts each January',
    monthly: 'Monthly — restarts each month',
    daily: 'Daily — restarts each day',
};

const STEPS = ['General', 'Format', 'Reset', 'Review'] as const;

/**
 * `group` is registry metadata, not a column — the route resolves this facet
 * against DOCUMENT_TYPES and pins the matching doc_types. Leaving it unset
 * hides the internal reference codes, which is why 'master' is offered as an
 * explicit choice rather than a hidden toggle.
 */
const FILTER_DEFS: DataTableFilterDef[] = [
    {
        key: 'group',
        label: 'Group',
        type: 'select',
        options: [
            { value: 'sales', label: 'Sales' },
            { value: 'inventory', label: 'Inventory' },
            { value: 'purchasing', label: 'Purchasing' },
            { value: 'master', label: 'Internal reference codes' },
        ],
    },
    {
        key: 'reset_rule',
        label: 'Resets',
        type: 'select',
        options: [
            { value: 'never', label: 'Never' },
            { value: 'yearly', label: 'Yearly' },
            { value: 'monthly', label: 'Monthly' },
            { value: 'daily', label: 'Daily' },
        ],
    },
    {
        key: 'is_active',
        label: 'Status',
        type: 'select',
        options: [
            { value: 'true', label: 'Active' },
            { value: 'false', label: 'Inactive' },
        ],
    },
];

/**
 * Settings → Document Numbering.
 *
 * Two surfaces: a list of every sequence, and a four-step wizard for changing
 * one. The wizard exists because the four decisions are genuinely sequential —
 * the reset options available at step 3 depend on the format chosen at step 2 —
 * so walking through them prevents the combination that silently breaks
 * document creation (see resetRuleIssue).
 *
 * Every preview on this page is rendered by renderDocumentNumber, the same
 * pure function the server uses to mint real numbers. It runs locally, so the
 * example updates as you type without a round trip, and it cannot drift from
 * what actually gets issued.
 */
export default function DocumentNumberingPage() {
    const toast = useToast();
    const [editing, setEditing] = useState<Sequence | null>(null);

    const table = useTableQuery<Sequence>({ endpoint: API });

    async function save(draft: Draft) {
        if (!editing) return;
        const res = await fetch(`${API}/${editing.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(draft),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? 'Failed to save');
        toast.success(`${editing.label} numbering saved`);
        setEditing(null);
        await table.refresh();
    }

    if (editing) {
        return (
            <NumberingWizard
                sequence={editing}
                onSaveAction={save}
                onCancelAction={() => setEditing(null)}
            />
        );
    }

    const columns: DataTableColumn<Sequence>[] = [
        {
            key: 'label',
            header: 'Document',
            primary: true,
            sortable: true,
            sortKey: 'doc_type',
            cell: (row) => (
                <div>
                    <span className="font-medium text-foreground">{row.label}</span>
                    <p className="text-xs text-muted-foreground">{row.doc_type}</p>
                </div>
            ),
        },
        {
            key: 'format',
            header: 'Format',
            cell: (row) => <span className="text-xs">{row.format}</span>,
        },
        {
            key: 'reset_rule',
            header: 'Resets',
            sortable: true,
            cell: (row) => (
                <span className="text-xs">
                    {RESET_LABELS[row.reset_rule].split(' — ')[0]}
                </span>
            ),
        },
        {
            key: 'preview',
            header: 'Next Number',
            align: 'right',
            cell: (row) => (
                <span className="font-medium text-primary tnums">{row.preview}</span>
            ),
        },
        {
            key: 'last_issued',
            header: 'Last Issued',
            align: 'right',
            hideOnCard: true,
            cell: (row) => (
                <span className="text-xs text-muted-foreground tnums">
                    {row.last_issued ?? '—'}
                </span>
            ),
        },
        {
            key: 'is_active',
            header: 'Status',
            sortable: true,
            cell: (row) => (
                <StatusBadge status={row.is_active ? 'ACTIVE' : 'INACTIVE'} />
            ),
        },
        {
            key: 'actions',
            header: 'Actions',
            sticky: 'right',
            align: 'right',
            cardFooter: true,
            cell: (row) => (
                <RowActions>
                    <RowAction
                        label="Configure"
                        icon={<Pencil size={13} />}
                        onClick={() => setEditing(row)}
                    />
                </RowActions>
            ),
        },
    ];

    return (
        <div className="space-y-4 font-mono">
            <PageHeader
                title="Document Numbering"
                description="How each document type numbers itself"
            />

            <DataTable<Sequence>
                columns={columns}
                data={table.data}
                keyExtractor={(row) => row.id}
                mobileVariant="cards"
                minTableWidth="900px"
                searchPlaceholder="Search by document type, prefix, or format..."
                pageSizeOptions={[10, 20, 50]}
                serverQuery={table.binding}
                filterDefs={FILTER_DEFS}
                enableColumnVisibility
                emptyTitle="No sequences configured"
                emptyDescription="No document sequences match your search criteria"
            />
        </div>
    );
}

/* ── Wizard ──────────────────────────────────────────────────────────────── */

function NumberingWizard({
    sequence,
    onSaveAction,
    onCancelAction,
}: {
    sequence: Sequence;
    onSaveAction: (draft: Draft) => Promise<void>;
    onCancelAction: () => void;
}) {
    const [step, setStep] = useState(0);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [draft, setDraft] = useState<Draft>({
        prefix: sequence.prefix,
        format: sequence.format,
        padding: sequence.padding,
        reset_rule: sequence.reset_rule,
        is_active: sequence.is_active,
    });

    const patch = (next: Partial<Draft>) =>
        setDraft((d) => ({ ...d, ...next }));

    /**
     * The live example, rendered by the same function the server mints with.
     *
     * Resolved against the CANDIDATE reset rule: switching one on is itself
     * what makes the stored period stale, so the very next document restarts
     * the count. Previewing the raw counter here would promise a number the
     * system is about to not issue.
     */
    const preview = useMemo(() => {
        try {
            return renderDocumentNumber(draft.format, {
                prefix: draft.prefix,
                sequence: effectiveNextValue({
                    reset_rule: draft.reset_rule,
                    period_key: sequence.period_key,
                    next_value: sequence.next_value,
                    now: new Date(),
                }),
                padding: draft.padding,
                now: new Date(),
            });
        } catch (e) {
            return e instanceof Error ? e.message : 'Invalid format';
        }
    }, [draft, sequence.next_value, sequence.period_key]);

    const formatError = useMemo(() => {
        try {
            validateDocumentFormat(draft.format);
            return null;
        } catch (e) {
            return e instanceof Error ? e.message : 'Invalid format';
        }
    }, [draft.format]);

    const resetError = useMemo(
        () => resetRuleIssue(draft.reset_rule, draft.format),
        [draft.reset_rule, draft.format],
    );

    const blocked =
        (step === 1 && formatError !== null) || (step === 2 && resetError !== null);

    async function submit() {
        setSaving(true);
        setError('');
        try {
            await onSaveAction(draft);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to save');
            setSaving(false);
        }
    }

    return (
        <div className="space-y-4 font-mono">
            <FormHeader
                icon={<Hash size={24} />}
                title={sequence.label}
                subtitle="Document numbering"
                actions={
                    <>
                        <HeaderAction
                            label="Discard"
                            icon={<X size={15} />}
                            onClick={onCancelAction}
                        />
                        <HeaderAction
                            label={saving ? 'Saving' : 'Save'}
                            icon={
                                saving ? (
                                    <Loader2 className="animate-spin" size={15} />
                                ) : (
                                    <Check size={15} />
                                )
                            }
                            tone="primary"
                            onClick={submit}
                            disabled={
                                saving || formatError !== null || resetError !== null
                            }
                        />
                    </>
                }
            />

            {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
                    {error}
                </div>
            )}

            <StepBar current={step} onJumpAction={setStep} />

            <SectionCard title={`Step ${step + 1} of 4 · ${STEPS[step]}`}>
                {step === 0 && (
                    <GeneralStep sequence={sequence} draft={draft} patchAction={patch} />
                )}
                {step === 1 && (
                    <FormatStep
                        draft={draft}
                        patchAction={patch}
                        error={formatError}
                    />
                )}
                {step === 2 && (
                    <ResetStep draft={draft} patchAction={patch} issue={resetError} />
                )}
                {step === 3 && (
                    <ReviewStep sequence={sequence} draft={draft} />
                )}

                <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                    <PreviewChip value={preview} invalid={formatError !== null} />
                    <div className="flex gap-2">
                        <button
                            type="button"
                            disabled={step === 0}
                            onClick={() => setStep((s) => s - 1)}
                            className="rounded-xl border border-slate-200 px-4 py-2 text-xs text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40"
                        >
                            Back
                        </button>
                        <button
                            type="button"
                            disabled={step === STEPS.length - 1 || blocked}
                            onClick={() => setStep((s) => s + 1)}
                            className="rounded-xl bg-[#1a9e52] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#158042] disabled:opacity-40"
                        >
                            Continue
                        </button>
                    </div>
                </div>
            </SectionCard>
        </div>
    );
}

function StepBar({
    current,
    onJumpAction,
}: {
    current: number;
    onJumpAction: (n: number) => void;
}) {
    return (
        <div className="flex flex-wrap items-center gap-2 text-xs">
            {STEPS.map((label, i) => {
                const done = i < current;
                const active = i === current;
                return (
                    <button
                        key={label}
                        type="button"
                        // Only backwards: a later step's options depend on the
                        // earlier choices, so skipping ahead could land on a
                        // reset policy the not-yet-chosen format cannot support.
                        disabled={i > current}
                        onClick={() => onJumpAction(i)}
                        className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 transition-colors disabled:cursor-not-allowed ${
                            active
                                ? 'border-[#1a9e52] bg-[#1a9e52]/10 font-semibold text-[#0f6b36]'
                                : done
                                  ? 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                  : 'border-slate-100 text-slate-300'
                        }`}
                    >
                        <span
                            className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                                done
                                    ? 'bg-[#1a9e52] text-white'
                                    : active
                                      ? 'bg-[#1a9e52] text-white'
                                      : 'bg-slate-100 text-slate-400'
                            }`}
                        >
                            {done ? <Check size={11} /> : i + 1}
                        </span>
                        {label}
                    </button>
                );
            })}
        </div>
    );
}

function PreviewChip({ value, invalid }: { value: string; invalid: boolean }) {
    return (
        <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-slate-400">
                Next number
            </p>
            <p
                className={`truncate text-sm font-bold ${
                    invalid ? 'text-red-600' : 'text-[#1a9e52]'
                }`}
            >
                {value}
            </p>
        </div>
    );
}

function GeneralStep({
    sequence,
    draft,
    patchAction,
}: {
    sequence: Sequence;
    draft: Draft;
    patchAction: (n: Partial<Draft>) => void;
}) {
    return (
        <div className="space-y-4 text-xs">
            <div className="grid gap-4 sm:grid-cols-2">
                <div>
                    <FieldLabel>Document</FieldLabel>
                    <p className="mt-1 text-sm font-semibold text-slate-800">
                        {sequence.label}
                    </p>
                </div>
                <div>
                    <FieldLabel>Last issued</FieldLabel>
                    <p className="mt-1 text-sm font-semibold text-slate-800">
                        {sequence.last_issued ?? 'None yet'}
                    </p>
                </div>
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3">
                <input
                    type="checkbox"
                    checked={draft.is_active}
                    onChange={(e) => patchAction({ is_active: e.target.checked })}
                    className="mt-0.5 h-4 w-4 accent-[#1a9e52]"
                />
                <span>
                    <span className="font-semibold text-slate-700">Active</span>
                    <span className="mt-0.5 block text-slate-500">
                        Turn this off to stop issuing new {sequence.label}{' '}
                        numbers. The counter is kept, so numbering resumes exactly
                        where it left off.
                    </span>
                </span>
            </label>
        </div>
    );
}

function FormatStep({
    draft,
    patchAction,
    error,
}: {
    draft: Draft;
    patchAction: (n: Partial<Draft>) => void;
    error: string | null;
}) {
    const isPreset = FORMAT_PRESETS.some((p) => p.format === draft.format);
    const [custom, setCustom] = useState(!isPreset);

    return (
        <div className="space-y-4 text-xs">
            <div className="grid gap-4 sm:grid-cols-2">
                <div>
                    <FieldLabel required>Prefix</FieldLabel>
                    <EditableInput
                        value={draft.prefix}
                        maxLength={20}
                        onChange={(e) => patchAction({ prefix: e.target.value })}
                    />
                </div>
                <div>
                    <FieldLabel required>Number length</FieldLabel>
                    <EditableSelect
                        value={String(draft.padding)}
                        onChange={(e) =>
                            patchAction({ padding: Number(e.target.value) })
                        }
                    >
                        {[3, 4, 5, 6, 7, 8].map((n) => (
                            <option key={n} value={n}>
                                {n} digits — {'1'.padStart(n, '0')}
                            </option>
                        ))}
                    </EditableSelect>
                </div>
            </div>

            <div>
                <FieldLabel required>Pattern</FieldLabel>
                <EditableSelect
                    value={custom ? 'custom' : draft.format}
                    onChange={(e) => {
                        if (e.target.value === 'custom') {
                            setCustom(true);
                            return;
                        }
                        setCustom(false);
                        patchAction({ format: e.target.value });
                    }}
                >
                    {FORMAT_PRESETS.map((p) => (
                        <option key={p.format} value={p.format}>
                            {p.sample.replace('SO', draft.prefix || 'SO')}
                        </option>
                    ))}
                    <option value="custom">Custom…</option>
                </EditableSelect>
            </div>

            {custom && (
                <div>
                    <FieldLabel required>Custom pattern</FieldLabel>
                    <EditableInput
                        value={draft.format}
                        onChange={(e) => patchAction({ format: e.target.value })}
                    />
                    <p className="mt-1.5 text-slate-500">
                        Placeholders:{' '}
                        <code className="text-slate-700">
                            {'{PREFIX} {YEAR} {YY} {MONTH} {DAY} {NUMBER}'}
                        </code>
                        . Anything else is written out literally.
                    </p>
                </div>
            )}

            {error && <p className="text-red-600">{error}</p>}
        </div>
    );
}

function ResetStep({
    draft,
    patchAction,
    issue,
}: {
    draft: Draft;
    patchAction: (n: Partial<Draft>) => void;
    issue: string | null;
}) {
    return (
        <div className="space-y-3 text-xs">
            <p className="text-slate-500">
                When the counter goes back to 1. The number restarts on the first
                document issued after the period changes — nothing runs at
                midnight.
            </p>

            <div className="grid gap-2">
                {DOCUMENT_RESET_RULES.map((rule) => {
                    // A policy whose period token is missing from the format
                    // would mint the same number twice — offer it, but explain
                    // why it cannot be chosen yet rather than hiding it.
                    const unusable = resetRuleIssue(rule, draft.format);
                    const selected = draft.reset_rule === rule;
                    return (
                        <label
                            key={rule}
                            className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                                selected
                                    ? 'border-[#1a9e52] bg-[#1a9e52]/5'
                                    : unusable
                                      ? 'border-slate-100 opacity-60'
                                      : 'border-slate-200 hover:bg-slate-50'
                            }`}
                        >
                            <input
                                type="radio"
                                name="reset_rule"
                                checked={selected}
                                disabled={unusable !== null}
                                onChange={() => patchAction({ reset_rule: rule })}
                                className="mt-0.5 h-4 w-4 accent-[#1a9e52]"
                            />
                            <span className="min-w-0">
                                <span className="font-semibold text-slate-700">
                                    {RESET_LABELS[rule]}
                                </span>
                                {unusable && (
                                    <span className="mt-0.5 block text-amber-700">
                                        {unusable}
                                    </span>
                                )}
                            </span>
                        </label>
                    );
                })}
            </div>

            {issue && <p className="text-red-600">{issue}</p>}
        </div>
    );
}

function ReviewStep({
    sequence,
    draft,
}: {
    sequence: Sequence;
    draft: Draft;
}) {
    const rows: Array<[string, string]> = [
        ['Document', sequence.label],
        ['Prefix', draft.prefix || '—'],
        ['Pattern', draft.format],
        ['Number length', `${draft.padding} digits`],
        ['Reset', RESET_LABELS[draft.reset_rule]],
        ['Status', draft.is_active ? 'Active' : 'Inactive'],
        ['Last issued', sequence.last_issued ?? 'None yet'],
    ];

    return (
        <div className="space-y-3 text-xs">
            <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                {rows.map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-4 px-3 py-2">
                        <span className="text-slate-400">{k}</span>
                        <span className="min-w-0 truncate font-semibold text-slate-700">
                            {v}
                        </span>
                    </div>
                ))}
            </div>
            <p className="text-slate-500">
                Saving changes only how future numbers are written. Documents that
                already exist keep the numbers they were issued with, and the
                counter does not move.
            </p>
        </div>
    );
}
