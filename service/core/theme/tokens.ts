/**
 * Company theme tokens — the single source of truth for tenant branding.
 *
 * This file is PURE DATA + pure functions (no server imports), like
 * service/core/authz/permissions.ts, so the settings form, the validation layer
 * and the server-side injector all share one definition and cannot drift.
 *
 * The token names are NOT invented here. They are exactly the semantic
 * variables app/globals.css already defines in `:root` and maps into Tailwind
 * through `@theme inline`. That mapping is what makes runtime theming possible
 * at all: because `@theme inline` inlines `var(--primary)` into the generated
 * utilities, redefining `--primary` at request time re-themes every existing
 * `bg-primary` / `text-foreground` / `border-border` in the app with no
 * rebuild and no dynamic class names.
 *
 * Values are stored as 6-digit HEX. The defaults below are the app's current
 * oklch defaults converted to sRGB, so "reset to default" reproduces today's
 * look exactly rather than an approximation of it.
 */

export type ThemeTokenKey =
    | 'background'
    | 'foreground'
    | 'card'
    | 'card-foreground'
    | 'popover'
    | 'popover-foreground'
    | 'primary'
    | 'primary-foreground'
    | 'secondary'
    | 'secondary-foreground'
    | 'muted'
    | 'muted-foreground'
    | 'accent'
    | 'accent-foreground'
    | 'destructive'
    | 'destructive-foreground'
    | 'border'
    | 'input'
    | 'ring';

export type ThemeTokens = Record<ThemeTokenKey, string>;
/** A saved theme overrides only what it sets; the rest falls back to default. */
export type PartialThemeTokens = Partial<ThemeTokens>;

export interface ThemeTokenDef {
    key: ThemeTokenKey;
    label: string;
    /** Grouping for the settings form. */
    group: 'Surface' | 'Brand' | 'Support' | 'Chrome';
    /** The surface this token is read against, for contrast checking. */
    contrastAgainst?: ThemeTokenKey;
    /**
     * Minimum acceptable contrast ratio against `contrastAgainst`.
     *
     * Not one blanket number, because WCAG does not use one: body copy must
     * clear 4.5:1 (1.4.3), while text that labels a UI component — a button, a
     * badge — clears at 3:1 (1.4.11, and the large/bold text allowance). Using
     * 4.5 everywhere would flag every brand colour whose button label is white,
     * which is most of them, and an alarm that always fires teaches admins to
     * ignore it.
     */
    minContrast?: number;
    hint?: string;
}

/** Body text. */
const TEXT = 4.5;
/** Text that labels a UI component (button, badge). */
const UI = 3;

/**
 * Order here is the order the settings form renders. `contrastAgainst` encodes
 * which pairs must stay legible — that relationship is a property of the design
 * system, not of the form, so it lives with the tokens.
 */
export const THEME_TOKENS: readonly ThemeTokenDef[] = [
    { key: 'background', label: 'Background', group: 'Surface', hint: 'Page background' },
    { key: 'foreground', label: 'Text', group: 'Surface', contrastAgainst: 'background', minContrast: TEXT },
    { key: 'card', label: 'Card', group: 'Surface' },
    { key: 'card-foreground', label: 'Card Text', group: 'Surface', contrastAgainst: 'card', minContrast: TEXT },
    { key: 'popover', label: 'Popover', group: 'Surface', hint: 'Dropdowns and dialogs' },
    { key: 'popover-foreground', label: 'Popover Text', group: 'Surface', contrastAgainst: 'popover', minContrast: TEXT },

    { key: 'primary', label: 'Primary', group: 'Brand', hint: 'Buttons and active states' },
    { key: 'primary-foreground', label: 'Primary Text', group: 'Brand', contrastAgainst: 'primary', minContrast: UI },
    { key: 'accent', label: 'Accent', group: 'Brand' },
    { key: 'accent-foreground', label: 'Accent Text', group: 'Brand', contrastAgainst: 'accent', minContrast: UI },

    { key: 'secondary', label: 'Secondary', group: 'Support' },
    { key: 'secondary-foreground', label: 'Secondary Text', group: 'Support', contrastAgainst: 'secondary', minContrast: TEXT },
    { key: 'muted', label: 'Muted', group: 'Support' },
    { key: 'muted-foreground', label: 'Muted Text', group: 'Support', contrastAgainst: 'muted', minContrast: TEXT },
    { key: 'destructive', label: 'Destructive', group: 'Support', hint: 'Delete and error actions' },
    { key: 'destructive-foreground', label: 'Destructive Text', group: 'Support', contrastAgainst: 'destructive', minContrast: UI },

    { key: 'border', label: 'Border', group: 'Chrome' },
    { key: 'input', label: 'Input Border', group: 'Chrome' },
    { key: 'ring', label: 'Focus Ring', group: 'Chrome' },
] as const;

export const THEME_TOKEN_KEYS: readonly ThemeTokenKey[] = THEME_TOKENS.map((t) => t.key);

/**
 * The ERP's current look, in hex. Generated from the oklch values in
 * app/globals.css `:root`, so a company that never touches the Theme tab and a
 * company that resets to default render identically.
 *
 * `destructive-foreground` is the one token globals.css does not define today
 * (the codebase uses --danger-foreground for that role); white is what the
 * destructive surfaces already assume.
 */
export const DEFAULT_THEME: ThemeTokens = {
    background: '#FFFFFF',
    foreground: '#0A0A0A',
    card: '#FFFFFF',
    'card-foreground': '#0A0A0A',
    popover: '#FFFFFF',
    'popover-foreground': '#0A0A0A',
    primary: '#00974C',
    'primary-foreground': '#FFFFFF',
    secondary: '#F5F5F5',
    'secondary-foreground': '#171717',
    muted: '#F5F5F5',
    'muted-foreground': '#737373',
    accent: '#F5F5F5',
    'accent-foreground': '#171717',
    destructive: '#E7000B',
    'destructive-foreground': '#FFFFFF',
    border: '#E5E5E5',
    input: '#E5E5E5',
    ring: '#00974C',
};

/* ── Presets ──────────────────────────────────────────────────────────────
 * Each preset only restates the tokens that make it distinctive; the rest is
 * the default. Keeping them partial means a future token addition does not
 * require editing six presets.
 */

export type ThemePresetId = 'default' | 'blue' | 'green' | 'purple' | 'orange' | 'slate';

export interface ThemePreset {
    id: ThemePresetId;
    label: string;
    tokens: PartialThemeTokens;
}

export const THEME_PRESETS: readonly ThemePreset[] = [
    { id: 'default', label: 'Default', tokens: {} },
    {
        id: 'blue',
        label: 'Blue',
        tokens: {
            primary: '#2563EB',
            'primary-foreground': '#FFFFFF',
            accent: '#EFF6FF',
            'accent-foreground': '#1E3A8A',
            ring: '#2563EB',
        },
    },
    {
        id: 'green',
        label: 'Green',
        tokens: {
            primary: '#16A34A',
            'primary-foreground': '#FFFFFF',
            accent: '#F0FDF4',
            'accent-foreground': '#14532D',
            ring: '#16A34A',
        },
    },
    {
        id: 'purple',
        label: 'Purple',
        tokens: {
            primary: '#7C3AED',
            'primary-foreground': '#FFFFFF',
            accent: '#F5F3FF',
            'accent-foreground': '#4C1D95',
            ring: '#7C3AED',
        },
    },
    {
        id: 'orange',
        label: 'Orange',
        tokens: {
            primary: '#EA580C',
            'primary-foreground': '#FFFFFF',
            accent: '#FFF7ED',
            'accent-foreground': '#7C2D12',
            ring: '#EA580C',
        },
    },
    {
        id: 'slate',
        label: 'Slate',
        tokens: {
            primary: '#334155',
            'primary-foreground': '#FFFFFF',
            accent: '#F1F5F9',
            'accent-foreground': '#0F172A',
            ring: '#334155',
        },
    },
] as const;

export function presetTokens(id: ThemePresetId): ThemeTokens {
    const preset = THEME_PRESETS.find((p) => p.id === id);
    return { ...DEFAULT_THEME, ...(preset?.tokens ?? {}) };
}

/* ── Validation ───────────────────────────────────────────────────────────
 * The security boundary (§18). A stored value reaches the browser inside a
 * `--token: <value>` declaration, so anything but a literal colour is a CSS
 * injection vector. Rather than blacklisting url()/expression()/javascript:,
 * this allows exactly one shape — six hex digits — which cannot express any of
 * them. The colour picker in the form is convenience, never the gate.
 */

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export function isValidHexColor(value: unknown): value is string {
    return typeof value === 'string' && HEX_RE.test(value);
}

/** Uppercases and expands #abc, so equal colours compare equal when stored. */
export function normalizeHexColor(value: string): string | null {
    const v = value.trim();
    const short = /^#([0-9a-fA-F]{3})$/.exec(v);
    if (short) {
        const [r, g, b] = short[1].split('');
        return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
    }
    return HEX_RE.test(v) ? v.toUpperCase() : null;
}

/**
 * Keeps only known tokens with valid colours. Unknown keys are dropped rather
 * than rejected so a theme saved by a newer build never bricks an older one.
 */
export function sanitizeThemeTokens(input: unknown): PartialThemeTokens {
    if (!input || typeof input !== 'object') return {};
    const raw = input as Record<string, unknown>;
    const out: PartialThemeTokens = {};
    for (const key of THEME_TOKEN_KEYS) {
        const value = raw[key];
        if (typeof value !== 'string') continue;
        const hex = normalizeHexColor(value);
        if (hex) out[key] = hex;
    }
    return out;
}

/** Fill in every token a company did not override. */
export function resolveTheme(tokens: PartialThemeTokens | null | undefined): ThemeTokens {
    return { ...DEFAULT_THEME, ...(tokens ?? {}) };
}

/* ── Accessibility (§19) ──────────────────────────────────────────────── */

function channel(hex: string, at: number): number {
    const v = parseInt(hex.slice(at, at + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

/** WCAG 2.1 relative luminance. */
export function relativeLuminance(hex: string): number {
    return (
        0.2126 * channel(hex, 1) +
        0.7152 * channel(hex, 3) +
        0.0722 * channel(hex, 5)
    );
}

/** WCAG contrast ratio, 1–21. */
export function contrastRatio(a: string, b: string): number {
    const la = relativeLuminance(a);
    const lb = relativeLuminance(b);
    const [hi, lo] = la > lb ? [la, lb] : [lb, la];
    return (hi + 0.05) / (lo + 0.05);
}

export type ContrastLevel = 'fail' | 'aa-large' | 'aa' | 'aaa';

export function contrastLevel(ratio: number): ContrastLevel {
    if (ratio >= 7) return 'aaa';
    if (ratio >= 4.5) return 'aa';
    if (ratio >= 3) return 'aa-large';
    return 'fail';
}

export interface ContrastWarning {
    token: ThemeTokenKey;
    against: ThemeTokenKey;
    ratio: number;
    level: ContrastLevel;
    /** The threshold this pair had to clear. */
    required: number;
}

/**
 * Every foreground/surface pair that does not clear WCAG AA. Advisory by
 * design: a company may have a brand that only reaches AA-large, and blocking
 * the save would be a business decision, not an accessibility one.
 */
export function contrastWarnings(tokens: ThemeTokens): ContrastWarning[] {
    const out: ContrastWarning[] = [];
    for (const def of THEME_TOKENS) {
        if (!def.contrastAgainst) continue;
        const required = def.minContrast ?? TEXT;
        const ratio = contrastRatio(tokens[def.key], tokens[def.contrastAgainst]);
        if (ratio < required) {
            out.push({
                token: def.key,
                against: def.contrastAgainst,
                ratio,
                level: contrastLevel(ratio),
                required,
            });
        }
    }
    return out;
}
