import {
    DEFAULT_THEME,
    THEME_TOKEN_KEYS,
    isValidHexColor,
    type PartialThemeTokens,
} from './tokens.ts';

/**
 * Turns a company's saved tokens into the CSS that overrides `:root`.
 *
 * Two deliberate choices:
 *
 *  - Only tokens that DIFFER from the default are emitted. A company on the
 *    stock theme ships zero bytes and inherits globals.css untouched, so the
 *    feature costs nothing for tenants that never use it.
 *
 *  - The selector is `:root:root`, not `:root`. Doubling the selector raises
 *    specificity above globals.css's own `:root` block, so the override wins
 *    regardless of whether the framework hoists this <style> above or below the
 *    stylesheet link. Relying on source order here would be a latent bug.
 *
 * Every value is re-validated immediately before serialization. The API already
 * validates on write, but this function is what actually composes CSS text, so
 * it refuses to be the place where an unvalidated string could get through.
 */
export function themeToCss(tokens: PartialThemeTokens | null | undefined): string {
    if (!tokens) return '';
    const decls: string[] = [];
    for (const key of THEME_TOKEN_KEYS) {
        const value = tokens[key];
        if (!value || !isValidHexColor(value)) continue;
        if (value.toUpperCase() === DEFAULT_THEME[key].toUpperCase()) continue;
        decls.push(`--${key}:${value}`);
    }
    if (decls.length === 0) return '';
    return `:root:root{${decls.join(';')}}`;
}
