'use client';

import { FieldLabel } from '@/components/ui/FieldLabel';
import { normalizeHexColor } from '@/service/core/theme/tokens';
import { AlertTriangle } from 'lucide-react';
import { useState } from 'react';

/**
 * One colour in the theme editor: a native swatch picker plus the hex the
 * swatch produced, editable directly.
 *
 * Native `<input type="color">` on purpose — it gives the OS picker (including
 * eyedropper on most platforms) for zero bytes. A React colour-picker package
 * would add a dependency to this bundle for a settings screen a company visits
 * once. The text input covers the one thing native cannot do: pasting a brand
 * hex from a style guide.
 *
 * The text field keeps its own draft so a half-typed "#25" is not repeatedly
 * rejected while the admin is still typing; it commits on blur.
 */
export function ThemeColorField({
    label,
    hint,
    value,
    onChangeAction,
    disabled,
    warning,
}: {
    label: string;
    hint?: string;
    /** Always a normalized 6-digit hex. */
    value: string;
    onChangeAction: (hex: string) => void;
    disabled?: boolean;
    /** Contrast advice for this colour, if any. */
    warning?: string;
}) {
    const [draft, setDraft] = useState(value);
    const [lastValue, setLastValue] = useState(value);

    // Follow external changes (preset applied, reset pressed) without fighting
    // the user's in-progress typing. Adjusted during render rather than in an
    // effect — React's documented pattern for deriving state from a prop, and
    // it avoids a paint showing the stale hex.
    if (value !== lastValue) {
        setLastValue(value);
        setDraft(value);
    }

    function commit(raw: string) {
        const hex = normalizeHexColor(raw);
        if (hex) onChangeAction(hex);
        else setDraft(value); // revert an unparseable entry
    }

    return (
        <div>
            <FieldLabel>{label}</FieldLabel>
            <div
                className={`flex items-center gap-2 rounded-xl border bg-white px-2 py-1.5 shadow-sm transition ${
                    warning ? 'border-amber-300' : 'border-slate-200'
                }`}
            >
                <input
                    type="color"
                    aria-label={`${label} colour picker`}
                    value={value}
                    disabled={disabled}
                    onChange={(e) => onChangeAction(e.target.value.toUpperCase())}
                    className="h-8 w-10 shrink-0 cursor-pointer rounded-lg border border-slate-200 bg-white disabled:cursor-not-allowed"
                />
                <input
                    type="text"
                    aria-label={`${label} hex value`}
                    value={draft}
                    disabled={disabled}
                    spellCheck={false}
                    maxLength={7}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={(e) => commit(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && commit(draft)}
                    className="w-full bg-transparent font-mono text-xs uppercase outline-none disabled:text-slate-400"
                />
            </div>
            {warning ? (
                <p className="mt-1 flex items-start gap-1 text-[11px] text-amber-600">
                    <AlertTriangle size={11} className="mt-0.5 shrink-0" />
                    {warning}
                </p>
            ) : (
                hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>
            )}
        </div>
    );
}
