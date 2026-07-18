// Serial generation strategies — a pure token-template engine. Every strategy
// is a preset template over the same renderer, so adding a strategy is one
// entry in STRATEGY_TEMPLATES (or a custom pattern in config) and never a
// change to transaction modules. Dependency-free and deterministic (clock and
// randomness are injectable) for `node --test`.

export type SerialStrategy =
    | 'sequential'
    | 'date_prefix'
    | 'item_prefix'
    | 'warehouse_prefix'
    | 'company_prefix'
    | 'random'
    | 'custom';

export type SerialResetRule = 'never' | 'yearly' | 'monthly' | 'daily';

export type SerialGenerationConfig = {
    strategy: SerialStrategy;
    prefix: string;
    suffix: string;
    seq_length: number;
    start_number: number;
    reset_rule: SerialResetRule;
    pattern: string | null;
};

export type SerialRenderContext = {
    itemCode?: string;
    warehouseCode?: string;
    companyCode?: string;
    now?: Date;
    /** Injectable RNG for tests; returns one random A–Z/0–9 char. */
    randomChar?: () => string;
};

export class SerialStrategyError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'SerialStrategyError';
    }
}

/**
 * Preset templates per strategy. Tokens:
 *   {PREFIX} {SUFFIX}       — configured literals
 *   {SEQ}                   — zero-padded sequence number (width = seq_length)
 *   {YYYY} {YY} {MM} {DD}   — generation date parts
 *   {ITEM} {WH} {COMPANY}   — sanitized entity codes
 *   {RAND}                  — random A–Z/0–9 block (width = seq_length)
 */
export const STRATEGY_TEMPLATES: Record<Exclude<SerialStrategy, 'custom'>, string> = {
    sequential: '{PREFIX}{SEQ}{SUFFIX}',
    date_prefix: '{PREFIX}{YYYY}{MM}{DD}{SEQ}{SUFFIX}',
    item_prefix: '{PREFIX}{ITEM}-{SEQ}{SUFFIX}',
    warehouse_prefix: '{PREFIX}{WH}-{SEQ}{SUFFIX}',
    company_prefix: '{PREFIX}{COMPANY}-{SEQ}{SUFFIX}',
    random: '{PREFIX}{RAND}{SUFFIX}',
};

const RANDOM_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L

/** Uppercase alphanumeric entity code (e.g. "iP-16 Pro" → "IP16PRO"). */
export function sanitizeCode(value: string | null | undefined): string {
    return (value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function resolveTemplate(config: SerialGenerationConfig): string {
    if (config.strategy === 'custom') {
        const pattern = config.pattern?.trim();
        if (!pattern) {
            throw new SerialStrategyError(
                'Custom strategy requires a pattern.',
            );
        }
        return pattern;
    }
    return STRATEGY_TEMPLATES[config.strategy];
}

/** Whether generation needs an atomic sequence block from the database. */
export function needsSequence(config: SerialGenerationConfig): boolean {
    return resolveTemplate(config).includes('{SEQ}');
}

/**
 * The sequence counter's scope key: strategy scope (company / per-item /
 * per-warehouse) combined with the reset period, so "reset monthly" is simply
 * a different counter row. Examples: `co|all`, `item:12|2026-07`, `wh:3|2026`.
 */
export function sequenceScopeKey(
    config: SerialGenerationConfig,
    ctx: { itemId?: number; warehouseId?: number; now?: Date },
): string {
    const d = ctx.now ?? new Date();
    const yyyy = String(d.getFullYear());
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const period =
        config.reset_rule === 'yearly'
            ? yyyy
            : config.reset_rule === 'monthly'
              ? `${yyyy}-${mm}`
              : config.reset_rule === 'daily'
                ? `${yyyy}-${mm}-${dd}`
                : 'all';

    const scope =
        config.strategy === 'item_prefix' && ctx.itemId
            ? `item:${ctx.itemId}`
            : config.strategy === 'warehouse_prefix' && ctx.warehouseId
              ? `wh:${ctx.warehouseId}`
              : 'co';

    return `${scope}|${period}`;
}

function defaultRandomChar(): string {
    return RANDOM_ALPHABET[Math.floor(Math.random() * RANDOM_ALPHABET.length)];
}

/**
 * Render `count` serials from a config, a reserved sequence block start, and
 * entity context. Pure: same inputs → same outputs (random via injectable rng).
 */
export function renderSerials(
    config: SerialGenerationConfig,
    count: number,
    blockStart: number,
    ctx: SerialRenderContext = {},
): string[] {
    if (count < 1) return [];
    const template = resolveTemplate(config);
    const d = ctx.now ?? new Date();
    const rand = ctx.randomChar ?? defaultRandomChar;
    const width = Math.max(config.seq_length, 1);

    const fixed: Record<string, string> = {
        '{PREFIX}': config.prefix ?? '',
        '{SUFFIX}': config.suffix ?? '',
        '{YYYY}': String(d.getFullYear()),
        '{YY}': String(d.getFullYear()).slice(-2),
        '{MM}': String(d.getMonth() + 1).padStart(2, '0'),
        '{DD}': String(d.getDate()).padStart(2, '0'),
        '{ITEM}': sanitizeCode(ctx.itemCode),
        '{WH}': sanitizeCode(ctx.warehouseCode),
        '{COMPANY}': sanitizeCode(ctx.companyCode),
    };

    const serials: string[] = [];
    for (let i = 0; i < count; i++) {
        let out = template;
        for (const [token, value] of Object.entries(fixed)) {
            out = out.split(token).join(value);
        }
        out = out
            .split('{SEQ}')
            .join(String(blockStart + i).padStart(width, '0'));
        while (out.includes('{RAND}')) {
            out = out.replace(
                '{RAND}',
                Array.from({ length: width }, () => rand()).join(''),
            );
        }
        serials.push(out);
    }
    return serials;
}
