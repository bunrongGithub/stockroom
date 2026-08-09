/**
 * Document number formatting — the pure half of the sequence core.
 *
 * Allocation (which number comes next) happens atomically in Postgres.
 * Formatting (what that number looks like) happens HERE, and nowhere else.
 * Splitting them this way is what makes "preview must not consume a number"
 * true by construction rather than by discipline: the settings screen and the
 * live allocator call the very same function, so a preview that disagrees with
 * reality is not possible.
 *
 * This module is deliberately dependency-free and side-effect-free — no
 * imports, no clock of its own — so it runs under `node --test` and is safe to
 * import from client components.
 *
 * Mirrors the shape of service/apps/inventory/serial/strategies.ts, which
 * solves the same problem for serial numbers. One template dialect, two
 * consumers.
 */

export type DocumentResetRule = 'never' | 'yearly' | 'monthly' | 'daily';

export const DOCUMENT_RESET_RULES: readonly DocumentResetRule[] = [
    'never',
    'yearly',
    'monthly',
    'daily',
] as const;

/**
 * The complete set of substitutions. Closed by design: rendering is literal
 * string replacement over this list, so a format string can never introduce
 * behaviour — there is no expression evaluation anywhere in this file.
 */
export const DOCUMENT_TOKENS = {
    '{PREFIX}': 'The configured prefix, e.g. SO',
    '{YEAR}': 'Four-digit year, e.g. 2026',
    '{YY}': 'Two-digit year, e.g. 26',
    '{MONTH}': 'Zero-padded month, e.g. 08',
    '{DAY}': 'Zero-padded day, e.g. 09',
    '{NUMBER}': 'The counter, zero-padded to Number Length',
} as const;

export type DocumentToken = keyof typeof DOCUMENT_TOKENS;

export const PADDING_MIN = 1;
export const PADDING_MAX = 12;

/** Ready-made formats offered in the UI, so most admins never see a token. */
export const FORMAT_PRESETS: ReadonlyArray<{
    format: string;
    label: string;
    sample: string;
}> = [
    { format: '{PREFIX}-{YEAR}-{NUMBER}', label: 'Prefix, year, number', sample: 'SO-2026-000001' },
    { format: '{PREFIX}/{YEAR}/{NUMBER}', label: 'Slash separated', sample: 'SO/2026/000001' },
    { format: '{PREFIX}-{YEAR}-{MONTH}-{NUMBER}', label: 'Prefix, year, month, number', sample: 'SO-2026-08-000001' },
    { format: '{PREFIX}-{NUMBER}', label: 'Prefix and number only', sample: 'SO-000001' },
];

export class DocumentFormatError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'DocumentFormatError';
    }
}

/** Every `{…}` occurrence in a format string, valid or not. */
function tokensIn(format: string): string[] {
    return format.match(/\{[^{}]*\}/g) ?? [];
}

function isKnownToken(token: string): token is DocumentToken {
    return Object.prototype.hasOwnProperty.call(DOCUMENT_TOKENS, token);
}

/**
 * Reject a format string that would misbehave once it is minting real
 * documents. Throws with a message written for an administrator, not a
 * developer.
 */
export function validateDocumentFormat(format: string): void {
    const trimmed = (format ?? '').trim();

    if (!trimmed) {
        throw new DocumentFormatError('Format is required.');
    }

    const found = tokensIn(trimmed);
    for (const token of found) {
        if (!isKnownToken(token)) {
            throw new DocumentFormatError(
                `${token} is not a valid placeholder. Available: ${Object.keys(DOCUMENT_TOKENS).join(', ')}.`,
            );
        }
    }

    // A stray brace means a mistyped placeholder that would otherwise be
    // printed literally into every document number, e.g. "SO-{NUMBER".
    const withoutTokens = found.reduce(
        (acc, token) => acc.split(token).join(''),
        trimmed,
    );
    if (withoutTokens.includes('{') || withoutTokens.includes('}')) {
        throw new DocumentFormatError(
            'Format has an unclosed placeholder. Each one must look like {NUMBER}.',
        );
    }

    // Without the counter every document renders the same string, and the
    // per-company unique index would reject every insert after the first.
    if (!found.includes('{NUMBER}')) {
        throw new DocumentFormatError(
            'Format must include {NUMBER}, otherwise every document would get the same number.',
        );
    }
}

/**
 * The period tokens a reset rule needs in order to mean anything.
 *
 * Resetting monthly with a format of `{PREFIX}-{NUMBER}` mints SO-000001 in
 * August and SO-000001 again in September — the second insert then fails on the
 * unique index. This is the easiest way for an administrator to break document
 * creation, so it is a hard validation rule rather than a warning.
 */
export const RESET_REQUIRED_TOKENS: Record<
    DocumentResetRule,
    ReadonlyArray<ReadonlyArray<DocumentToken>>
> = {
    // Each inner array is an OR-group; every group must be satisfied.
    never: [],
    yearly: [['{YEAR}', '{YY}']],
    monthly: [['{YEAR}', '{YY}'], ['{MONTH}']],
    daily: [['{YEAR}', '{YY}'], ['{MONTH}'], ['{DAY}']],
};

/** Whether a reset rule can be used with a format, and why not if it cannot. */
export function resetRuleIssue(
    reset: DocumentResetRule,
    format: string,
): string | null {
    const found = tokensIn(format);
    const missing = RESET_REQUIRED_TOKENS[reset]
        .filter((group) => !group.some((token) => found.includes(token)))
        .map((group) => group.join(' or '));

    if (missing.length === 0) return null;
    return `${reset[0].toUpperCase()}${reset.slice(1)} reset needs ${missing.join(' and ')} in the format, otherwise numbers repeat when the period rolls over.`;
}

export function assertResetMatchesFormat(
    reset: DocumentResetRule,
    format: string,
): void {
    const issue = resetRuleIssue(reset, format);
    if (issue) throw new DocumentFormatError(issue);
}

export function validatePadding(padding: number): void {
    if (!Number.isInteger(padding) || padding < PADDING_MIN || padding > PADDING_MAX) {
        throw new DocumentFormatError(
            `Number length must be a whole number between ${PADDING_MIN} and ${PADDING_MAX}.`,
        );
    }
}

export type DocumentFormatContext = {
    prefix: string;
    /** The allocated counter value. */
    sequence: number;
    /** Zero-padding width for {NUMBER}. */
    padding: number;
    /** Injected so tests are deterministic across period boundaries. */
    now: Date;
};

/**
 * Render one document number.
 *
 * Note on {NUMBER}: padding is a MINIMUM width, never a truncation. Once a
 * sequence outgrows its padding the number simply gets longer — losing the
 * high digits would collide with an earlier document.
 */
export function renderDocumentNumber(
    format: string,
    ctx: DocumentFormatContext,
): string {
    validateDocumentFormat(format);
    validatePadding(ctx.padding);

    if (!Number.isInteger(ctx.sequence) || ctx.sequence < 1) {
        throw new DocumentFormatError(
            `Sequence must be a positive whole number (received ${ctx.sequence}).`,
        );
    }

    const d = ctx.now;
    const year = String(d.getFullYear()).padStart(4, '0');

    const values: Record<DocumentToken, string> = {
        '{PREFIX}': ctx.prefix ?? '',
        '{YEAR}': year,
        '{YY}': year.slice(-2),
        '{MONTH}': String(d.getMonth() + 1).padStart(2, '0'),
        '{DAY}': String(d.getDate()).padStart(2, '0'),
        '{NUMBER}': String(ctx.sequence).padStart(ctx.padding, '0'),
    };

    let out = format.trim();
    for (const [token, value] of Object.entries(values)) {
        out = out.split(token).join(value);
    }
    return out;
}

/**
 * The number the NEXT allocation will actually hand out.
 *
 * `next_value` alone is not the answer. When a reset rule is in force and the
 * stored period is stale — a new year has started, or an administrator has just
 * switched the rule on — the allocator restarts the count in the same statement
 * that issues the number. A preview that read `next_value` directly would
 * promise SO-2026-000058 and then watch the system mint SO-2026-000001.
 *
 * Mirrors the CASE expression in allocate_document_number(); the pair is
 * covered by tests/document-sequence-db.test.mjs.
 */
export function effectiveNextValue(seq: {
    reset_rule: DocumentResetRule;
    period_key: string;
    next_value: number;
    now: Date;
}): number {
    if (seq.reset_rule === 'never') return seq.next_value;
    const current = periodKeyFor(seq.reset_rule, seq.now);
    return seq.period_key === current ? seq.next_value : 1;
}

/**
 * The period bucket a reset rule counts within.
 *
 * The authoritative period_key is computed by the database from its own clock,
 * because that is where allocation happens — a browser in another timezone must
 * not decide which year a document belongs to. This function exists so the
 * settings screen can *explain* the current period and so the boundary logic is
 * unit-testable; it is never the source of truth for an allocation.
 */
export function periodKeyFor(reset: DocumentResetRule, now: Date): string {
    const year = String(now.getFullYear()).padStart(4, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    switch (reset) {
        case 'yearly':
            return year;
        case 'monthly':
            return `${year}-${month}`;
        case 'daily':
            return `${year}-${month}-${day}`;
        case 'never':
            return '';
    }
}
