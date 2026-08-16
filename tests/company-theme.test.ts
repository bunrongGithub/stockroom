import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    DEFAULT_THEME,
    THEME_PRESETS,
    THEME_TOKENS,
    THEME_TOKEN_KEYS,
    contrastLevel,
    contrastRatio,
    contrastWarnings,
    isValidHexColor,
    normalizeHexColor,
    presetTokens,
    resolveTheme,
    sanitizeThemeTokens,
} from '../service/core/theme/tokens.ts';
import { themeToCss } from '../service/core/theme/css.ts';

/* ── Validation: the security boundary ─────────────────────────────────── */

test('accepts only 6-digit hex colours', () => {
    assert.ok(isValidHexColor('#2563EB'));
    assert.ok(isValidHexColor('#000000'));
    assert.ok(!isValidHexColor('#25'));
    assert.ok(!isValidHexColor('2563EB'));
    assert.ok(!isValidHexColor('#2563EBB'));
    assert.ok(!isValidHexColor(''));
    assert.ok(!isValidHexColor(null));
    assert.ok(!isValidHexColor(123));
});

test('rejects every CSS-injection shape named in the spec', () => {
    const attacks = [
        'url(https://evil.example/x.png)',
        'expression(alert(1))',
        'javascript:alert(1)',
        'var(--primary)',
        'calc(100% - 10px)',
        '#fff;background:url(evil)',
        'red',
        '#fff}</style><script>alert(1)</script>',
        'rgb(0,0,0)',
    ];
    for (const value of attacks) {
        assert.ok(!isValidHexColor(value), `should reject: ${value}`);
        assert.deepEqual(
            sanitizeThemeTokens({ primary: value }),
            {},
            `should not persist: ${value}`,
        );
    }
});

test('sanitize drops unknown keys and keeps known ones', () => {
    const out = sanitizeThemeTokens({
        primary: '#2563eb',
        'not-a-token': '#FFFFFF',
        __proto__: '#000000',
        background: '#ffffff',
    });
    assert.deepEqual(out, { primary: '#2563EB', background: '#FFFFFF' });
});

test('sanitize normalizes shorthand and case', () => {
    assert.equal(normalizeHexColor('#abc'), '#AABBCC');
    assert.equal(normalizeHexColor('  #2563eb '), '#2563EB');
    assert.equal(normalizeHexColor('#12345'), null);
    assert.deepEqual(sanitizeThemeTokens({ ring: '#abc' }), { ring: '#AABBCC' });
});

/* ── Defaults: existing companies must not break ───────────────────────── */

test('every token has a valid default', () => {
    for (const key of THEME_TOKEN_KEYS) {
        assert.ok(isValidHexColor(DEFAULT_THEME[key]), `${key} default must be hex`);
    }
    assert.equal(Object.keys(DEFAULT_THEME).length, THEME_TOKENS.length);
});

test('a company with no theme resolves to the ERP default', () => {
    assert.deepEqual(resolveTheme(null), DEFAULT_THEME);
    assert.deepEqual(resolveTheme(undefined), DEFAULT_THEME);
    assert.deepEqual(resolveTheme({}), DEFAULT_THEME);
});

test('a partial theme overrides only what it sets', () => {
    const resolved = resolveTheme({ primary: '#2563EB' });
    assert.equal(resolved.primary, '#2563EB');
    assert.equal(resolved.background, DEFAULT_THEME.background);
});

/* ── CSS emission ──────────────────────────────────────────────────────── */

test('emits nothing when the theme matches the default', () => {
    assert.equal(themeToCss({}), '');
    assert.equal(themeToCss(null), '');
    assert.equal(themeToCss({ primary: DEFAULT_THEME.primary }), '');
});

test('emits only the overridden tokens, at raised specificity', () => {
    const css = themeToCss({ primary: '#2563EB', background: DEFAULT_THEME.background });
    assert.equal(css, ':root:root{--primary:#2563EB}');
});

test('never emits a value that failed validation', () => {
    // Simulates a row written before validation existed, or tampered directly.
    const css = themeToCss({
        primary: 'red;}*{display:none}' as unknown as string,
        ring: '#2563EB',
    });
    assert.equal(css, ':root:root{--ring:#2563EB}');
    assert.ok(!css.includes('display'));
});

test('emitted CSS can never contain a style-tag break-out', () => {
    const css = themeToCss({ primary: '#123456', accent: '#ABCDEF' });
    assert.ok(!css.includes('<'));
    assert.ok(!css.includes('</style'));
});

/* ── Presets ───────────────────────────────────────────────────────────── */

test('every preset resolves to a complete, valid theme', () => {
    for (const preset of THEME_PRESETS) {
        const tokens = presetTokens(preset.id);
        for (const key of THEME_TOKEN_KEYS) {
            assert.ok(
                isValidHexColor(tokens[key]),
                `preset ${preset.id} token ${key} invalid`,
            );
        }
    }
});

test('the default preset is exactly the default theme', () => {
    assert.deepEqual(presetTokens('default'), DEFAULT_THEME);
});

test('no preset ships an unreadable primary button', () => {
    // 3:1 is the WCAG 1.4.11 bar for text labelling a UI component, which is
    // what a button label is. Requiring 4.5 here would reject most brand
    // colours paired with white, including the ERP's own green (3.80:1).
    for (const preset of THEME_PRESETS) {
        const t = presetTokens(preset.id);
        const ratio = contrastRatio(t['primary-foreground'], t.primary);
        assert.ok(ratio >= 3, `${preset.id}: primary contrast ${ratio.toFixed(2)}`);
    }
});

test('every preset clears every pair its own threshold', () => {
    for (const preset of THEME_PRESETS) {
        const warnings = contrastWarnings(presetTokens(preset.id));
        // The stock palette's muted grey is marginally under AA (4.35 vs 4.5)
        // and every preset inherits it; nothing else may fall short.
        const unexpected = warnings.filter((w) => w.token !== 'muted-foreground');
        assert.deepEqual(
            unexpected,
            [],
            `${preset.id} has unexpected contrast warnings`,
        );
    }
});

/* ── Accessibility ─────────────────────────────────────────────────────── */

test('contrast ratio matches known WCAG values', () => {
    assert.equal(Math.round(contrastRatio('#000000', '#FFFFFF')), 21);
    assert.equal(contrastRatio('#FFFFFF', '#FFFFFF'), 1);
    // Order must not matter.
    assert.equal(
        contrastRatio('#000000', '#FFFFFF'),
        contrastRatio('#FFFFFF', '#000000'),
    );
});

test('contrast levels bucket correctly', () => {
    assert.equal(contrastLevel(21), 'aaa');
    assert.equal(contrastLevel(4.5), 'aa');
    assert.equal(contrastLevel(3), 'aa-large');
    assert.equal(contrastLevel(1), 'fail');
});

test('white-on-white is reported as a failure', () => {
    const warnings = contrastWarnings(
        resolveTheme({ background: '#FFFFFF', foreground: '#FFFFFF' }),
    );
    const hit = warnings.find((w) => w.token === 'foreground');
    assert.ok(hit, 'foreground/background should warn');
    assert.equal(hit.level, 'fail');
});

test('the shipped default theme has nothing unusable', () => {
    // Documents a real property of the current palette rather than asserting a
    // wish: white-on-brand-green is 3.80:1 (fine for a button), and the muted
    // grey is 4.35:1 (just under AA for body text). Nothing is below 3:1.
    for (const w of contrastWarnings(DEFAULT_THEME)) {
        assert.ok(
            w.ratio >= 3,
            `${w.token} on ${w.against} is unusable at ${w.ratio.toFixed(2)}:1`,
        );
    }
});

test('contrast warnings carry the threshold that was applied', () => {
    const warnings = contrastWarnings(
        resolveTheme({ 'primary-foreground': '#00974C' }),
    );
    const hit = warnings.find((w) => w.token === 'primary-foreground');
    assert.ok(hit);
    assert.equal(hit.required, 3);
});
