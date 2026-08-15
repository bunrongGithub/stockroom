import { Bokor, Geist_Mono } from 'next/font/google';

/**
 * The system runs on exactly two faces, picked per character rather than per
 * element: Geist Mono for Latin, Bokor for Khmer.
 *
 * The switch is the browser's, not ours. Every @font-face Google ships carries
 * a `unicode-range`, so a stack of `Geist Mono, Bokor` resolves per glyph:
 * Latin codepoints match Geist Mono, Khmer codepoints match nothing there and
 * fall through to Bokor. No `lang` attributes, no wrapper components, and
 * mixed-script strings ("ស្តុប DN") render correctly word by word.
 *
 * Two things this depends on, both checked against the emitted CSS:
 *
 *  - ORDER. `subsets` only controls which files are *preloaded*; next/font
 *    still emits every @font-face Google returns, so Bokor also declares a
 *    Latin range. Geist Mono must come first or Bokor would win Latin too.
 *
 *  - The stack in globals.css names the families literally rather than using
 *    `var(--font-latin)`. Those variables expand to `"Geist Mono", "Geist Mono
 *    Fallback"`, and the metric-adjusted Fallback face carries NO
 *    unicode-range — it matches every character, so sitting ahead of Bokor it
 *    would swallow Khmer before Bokor was consulted. (`adjustFontFallback:
 *    false` does not suppress it on Next 16; verified in the build output.)
 *    The variables are still exported below because assigning them is what
 *    links the @font-face rules into the page.
 *
 * Declared here rather than in the layout because the app has more than one
 * root <html> — global-not-found renders its own, and the fonts have to be
 * loaded there too. The stack itself lives in globals.css.
 */
export const fontLatin = Geist_Mono({
    subsets: ['latin'],
    variable: '--font-latin',
});

/** Bokor ships a single weight; bold Khmer is synthesised by the browser. */
export const fontKhmer = Bokor({
    subsets: ['khmer'],
    weight: '400',
    variable: '--font-khmer',
});

/** Everything a root <html> needs to opt into the two-font rule. */
export const fontClassName = `${fontKhmer.variable} ${fontLatin.variable} font-mono`;
