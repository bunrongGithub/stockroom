'use client';

import { ThemeColorField } from '@/components/ui/ThemeColorField';
import {
    DEFAULT_THEME,
    THEME_PRESETS,
    THEME_TOKENS,
    contrastWarnings,
    presetTokens,
    resolveTheme,
    type PartialThemeTokens,
    type ThemePresetId,
    type ThemeTokenKey,
    type ThemeTokens,
} from '@/service/core/theme/tokens';
import { ThemePreview } from './ThemePreview';
import { AlertCircle, Check, Loader2, Palette, RotateCcw, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

const GROUPS = ['Surface', 'Brand', 'Support', 'Chrome'] as const;

const ENDPOINT = '/api/setting/company/theme';

/**
 * Company Theme settings.
 *
 * Everything the admin does here is local until Save: the draft lives in state,
 * the preview reads the draft, and the company's stored theme is untouched if
 * they navigate away (§10, §11).
 *
 * On save we persist and then `router.refresh()`. The dashboard layout is a
 * server component that resolves the theme per request, so refreshing re-runs
 * it and the new colours apply to the whole ERP immediately — no logout/login
 * required, while a fresh login naturally renders the same thing.
 */
export default function ThemeTab({ canUpdate }: { canUpdate: boolean }) {
    const router = useRouter();

    const [preset, setPreset] = useState<ThemePresetId>('default');
    const [tokens, setTokens] = useState<ThemeTokens>(DEFAULT_THEME);
    const [saved, setSaved] = useState<PartialThemeTokens>({});

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [done, setDone] = useState(false);

    useEffect(() => {
        let active = true;
        fetch(ENDPOINT)
            .then((r) => r.json())
            .then((json) => {
                if (!active) return;
                const theme = json?.data ?? {};
                setPreset(theme.preset ?? 'default');
                setSaved(theme.light ?? {});
                setTokens(resolveTheme(theme.light));
            })
            .catch(() => active && setError('Could not load the company theme.'))
            .finally(() => active && setLoading(false));
        return () => {
            active = false;
        };
    }, []);

    /** Only what differs from the default is persisted — see themeToCss. */
    const overrides = useMemo(() => {
        const out: PartialThemeTokens = {};
        for (const { key } of THEME_TOKENS) {
            if (tokens[key].toUpperCase() !== DEFAULT_THEME[key].toUpperCase()) {
                out[key] = tokens[key];
            }
        }
        return out;
    }, [tokens]);

    const dirty = useMemo(
        () => JSON.stringify(overrides) !== JSON.stringify(saved),
        [overrides, saved],
    );

    const warnings = useMemo(() => contrastWarnings(tokens), [tokens]);
    const warningFor = useMemo(() => {
        const map = new Map<ThemeTokenKey, string>();
        for (const w of warnings) {
            map.set(
                w.token,
                `Contrast ${w.ratio.toFixed(1)}:1 against ${w.against.replace('-', ' ')} — below the ${w.required}:1 this pair needs.`,
            );
        }
        return map;
    }, [warnings]);

    function setToken(key: ThemeTokenKey, hex: string) {
        setDone(false);
        setTokens((t) => ({ ...t, [key]: hex }));
    }

    function applyPreset(id: ThemePresetId) {
        setDone(false);
        setPreset(id);
        setTokens(presetTokens(id));
    }

    function resetToDefault() {
        setDone(false);
        setPreset('default');
        setTokens(DEFAULT_THEME);
    }

    async function save() {
        setSaving(true);
        setError('');
        try {
            const res = await fetch(ENDPOINT, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ preset, tokens: overrides }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error ?? 'Failed to save the theme.');
            setSaved(overrides);
            setDone(true);
            // Re-runs the server layout, which re-resolves and re-injects the
            // theme for the whole app.
            router.refresh();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to save the theme.');
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center gap-2 py-16 text-slate-400">
                <Loader2 size={16} className="animate-spin" /> Loading theme…
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                <div className="mb-1 flex items-center gap-2">
                    <Palette size={14} className="text-[#1a9e52]" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Company Theme
                    </h3>
                </div>
                <p className="mb-4 text-slate-500">
                    Customize how the ERP appears for everyone in this company.
                </p>

                {error && (
                    <div className="mb-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700">
                        <AlertCircle size={15} className="mt-0.5 shrink-0" />
                        {error}
                    </div>
                )}

                {!canUpdate && (
                    <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-500">
                        You have read-only access to this company&apos;s theme.
                    </div>
                )}

                {/* Presets */}
                <div className="mb-5">
                    <p className="mb-2 font-semibold text-slate-600">Theme Preset</p>
                    <div className="flex flex-wrap gap-2">
                        {THEME_PRESETS.map((p) => {
                            const swatch = presetTokens(p.id);
                            const on = preset === p.id;
                            return (
                                <button
                                    key={p.id}
                                    type="button"
                                    disabled={!canUpdate}
                                    onClick={() => applyPreset(p.id)}
                                    className={`flex items-center gap-2 rounded-xl border px-3 py-2 transition ${
                                        on
                                            ? 'border-[#1a9e52] bg-[#1a9e52]/5 text-[#1a9e52]'
                                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                    } disabled:opacity-50`}
                                >
                                    <span
                                        style={{ background: swatch.primary }}
                                        className="h-4 w-4 rounded-full border border-black/10"
                                    />
                                    {p.label}
                                    {on && <Check size={12} />}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
                    {/* Colour fields, grouped */}
                    <div className="space-y-5">
                        {GROUPS.map((group) => (
                            <div key={group}>
                                <p className="mb-2 font-semibold text-slate-600">{group}</p>
                                <div className="grid gap-4 sm:grid-cols-2">
                                    {THEME_TOKENS.filter((t) => t.group === group).map((t) => (
                                        <ThemeColorField
                                            key={t.key}
                                            label={t.label}
                                            hint={t.hint}
                                            value={tokens[t.key]}
                                            disabled={!canUpdate}
                                            warning={warningFor.get(t.key)}
                                            onChangeAction={(hex) => setToken(t.key, hex)}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Live preview */}
                    <div className="xl:sticky xl:top-6 xl:self-start">
                        <p className="mb-2 font-semibold text-slate-600">Live Preview</p>
                        <ThemePreview tokens={tokens} />
                        <ContrastSummary tokens={tokens} />
                    </div>
                </div>

                {/* Actions */}
                <div className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-4">
                    {done && !dirty && (
                        <span className="mr-auto flex items-center gap-1.5 text-emerald-600">
                            <Check size={14} /> Theme saved and applied
                        </span>
                    )}
                    {dirty && (
                        <span className="mr-auto text-amber-600">Unsaved changes</span>
                    )}
                    <button
                        type="button"
                        disabled={!canUpdate || saving}
                        onClick={resetToDefault}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
                    >
                        <RotateCcw size={15} /> Reset to Default
                    </button>
                    <button
                        type="button"
                        disabled={!canUpdate || saving || !dirty}
                        onClick={save}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#1a9e52] px-4 py-2.5 font-semibold text-white transition-colors hover:bg-[#158042] disabled:opacity-50"
                    >
                        {saving ? (
                            <Loader2 size={15} className="animate-spin" />
                        ) : (
                            <Save size={15} />
                        )}
                        {saving ? 'Saving…' : 'Save Theme'}
                    </button>
                </div>
            </section>
        </div>
    );
}

/**
 * The accessibility read-out (§19). Advisory, never blocking — it reports the
 * pairs that fall short so an admin can make an informed call.
 */
function ContrastSummary({ tokens }: { tokens: ThemeTokens }) {
    const failing = contrastWarnings(tokens);
    const labelOf = (key: string) =>
        THEME_TOKENS.find((t) => t.key === key)?.label ?? key;

    if (failing.length === 0) {
        return (
            <p className="mt-3 flex items-center gap-1.5 text-emerald-600">
                <Check size={13} /> All colour pairs meet their WCAG minimum.
            </p>
        );
    }
    return (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-amber-700">
            <p className="font-semibold">
                {failing.length} colour pair{failing.length > 1 ? 's' : ''} may be hard to
                read
            </p>
            <ul className="mt-1 space-y-0.5">
                {failing.map((w) => (
                    <li key={w.token}>
                        {labelOf(w.token)} on {labelOf(w.against)} —{' '}
                        {w.ratio.toFixed(1)}:1, needs {w.required}:1
                    </li>
                ))}
            </ul>
        </div>
    );
}
