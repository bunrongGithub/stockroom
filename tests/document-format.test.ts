import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
    DOCUMENT_TOKENS,
    DocumentFormatError,
    FORMAT_PRESETS,
    PADDING_MAX,
    assertResetMatchesFormat,
    effectiveNextValue,
    periodKeyFor,
    renderDocumentNumber,
    resetRuleIssue,
    validateDocumentFormat,
    validatePadding,
    type DocumentResetRule,
} from '../service/core/document-format.ts';

/** A fixed clock: 09 August 2026. Every date assertion below leans on it. */
const NOW = new Date(2026, 7, 9, 14, 30, 0);

const ctx = (over: Partial<Parameters<typeof renderDocumentNumber>[1]> = {}) => ({
    prefix: 'SO',
    sequence: 1,
    padding: 6,
    now: NOW,
    ...over,
});

describe('renderDocumentNumber — tokens', () => {
    it('renders every supported token', () => {
        const out = renderDocumentNumber(
            '{PREFIX}|{YEAR}|{YY}|{MONTH}|{DAY}|{NUMBER}',
            ctx({ sequence: 42 }),
        );
        assert.equal(out, 'SO|2026|26|08|09|000042');
    });

    it('renders each of the four documented formats exactly', () => {
        const cases: Array<[string, number, string, string]> = [
            ['{PREFIX}-{YEAR}-{NUMBER}', 1, 'SO', 'SO-2026-000001'],
            ['{PREFIX}/{YEAR}/{NUMBER}', 1, 'SO', 'SO/2026/000001'],
            ['{PREFIX}-{YEAR}-{MONTH}-{NUMBER}', 1, 'INV', 'INV-2026-08-000001'],
            ['{PREFIX}-{NUMBER}', 1, 'CS', 'CS-000001'],
        ];
        for (const [format, sequence, prefix, expected] of cases) {
            assert.equal(
                renderDocumentNumber(format, ctx({ sequence, prefix })),
                expected,
                format,
            );
        }
    });

    it('every advertised preset renders its advertised sample', () => {
        for (const preset of FORMAT_PRESETS) {
            const prefix = preset.sample.split(/[-/]/)[0];
            assert.equal(
                renderDocumentNumber(preset.format, ctx({ prefix, sequence: 1 })),
                preset.sample,
                preset.format,
            );
        }
    });

    it('repeats a token that appears more than once', () => {
        assert.equal(
            renderDocumentNumber('{YEAR}-{PREFIX}-{YEAR}-{NUMBER}', ctx()),
            '2026-SO-2026-000001',
        );
    });

    it('keeps literal text and separators untouched', () => {
        assert.equal(
            renderDocumentNumber('ACME {PREFIX} no. {NUMBER}', ctx({ sequence: 7 })),
            'ACME SO no. 000007',
        );
    });

    it('tolerates an empty prefix', () => {
        assert.equal(
            renderDocumentNumber('{PREFIX}{NUMBER}', ctx({ prefix: '' })),
            '000001',
        );
    });
});

describe('renderDocumentNumber — padding', () => {
    it('zero-pads to the configured width', () => {
        assert.equal(
            renderDocumentNumber('{NUMBER}', ctx({ sequence: 5, padding: 4 })),
            '0005',
        );
    });

    it('NEVER truncates a number wider than the padding', () => {
        // Losing high digits would collide with an earlier document.
        assert.equal(
            renderDocumentNumber('{NUMBER}', ctx({ sequence: 1234567, padding: 3 })),
            '1234567',
        );
    });

    it('accepts the padding bounds and rejects everything outside them', () => {
        assert.doesNotThrow(() => validatePadding(1));
        assert.doesNotThrow(() => validatePadding(PADDING_MAX));
        for (const bad of [0, -1, PADDING_MAX + 1, 2.5, NaN]) {
            assert.throws(() => validatePadding(bad), DocumentFormatError, String(bad));
        }
    });
});

describe('renderDocumentNumber — rejected input', () => {
    it('rejects an unknown placeholder rather than printing it literally', () => {
        assert.throws(
            () => renderDocumentNumber('{PREFIX}-{YAER}-{NUMBER}', ctx()),
            (e: Error) =>
                e instanceof DocumentFormatError && e.message.includes('{YAER}'),
        );
    });

    it('rejects a format with no {NUMBER}', () => {
        assert.throws(
            () => renderDocumentNumber('{PREFIX}-{YEAR}', ctx()),
            (e: Error) =>
                e instanceof DocumentFormatError &&
                e.message.includes('{NUMBER}'),
        );
    });

    it('rejects an unclosed placeholder', () => {
        assert.throws(
            () => validateDocumentFormat('SO-{NUMBER'),
            DocumentFormatError,
        );
        assert.throws(
            () => validateDocumentFormat('{NUMBER}}'),
            DocumentFormatError,
        );
    });

    it('rejects an empty or blank format', () => {
        assert.throws(() => validateDocumentFormat(''), DocumentFormatError);
        assert.throws(() => validateDocumentFormat('   '), DocumentFormatError);
    });

    it('rejects a non-positive or fractional sequence', () => {
        for (const bad of [0, -1, 1.5]) {
            assert.throws(
                () => renderDocumentNumber('{NUMBER}', ctx({ sequence: bad })),
                DocumentFormatError,
                String(bad),
            );
        }
    });

    it('accepts every documented token as valid', () => {
        for (const token of Object.keys(DOCUMENT_TOKENS)) {
            assert.doesNotThrow(
                () => validateDocumentFormat(`${token}{NUMBER}`),
                token,
            );
        }
    });
});

describe('reset rule ↔ format compatibility', () => {
    const ok: Array<[DocumentResetRule, string]> = [
        ['never', '{PREFIX}-{NUMBER}'],
        ['never', '{PREFIX}-{YEAR}-{NUMBER}'],
        ['yearly', '{PREFIX}-{YEAR}-{NUMBER}'],
        ['yearly', '{PREFIX}-{YY}-{NUMBER}'],
        ['monthly', '{PREFIX}-{YEAR}-{MONTH}-{NUMBER}'],
        ['monthly', '{PREFIX}-{YY}{MONTH}-{NUMBER}'],
        ['daily', '{PREFIX}-{YEAR}{MONTH}{DAY}-{NUMBER}'],
    ];

    const bad: Array<[DocumentResetRule, string]> = [
        ['yearly', '{PREFIX}-{NUMBER}'],
        ['yearly', '{PREFIX}-{MONTH}-{NUMBER}'],
        ['monthly', '{PREFIX}-{YEAR}-{NUMBER}'],
        ['monthly', '{PREFIX}-{MONTH}-{NUMBER}'],
        ['daily', '{PREFIX}-{YEAR}-{MONTH}-{NUMBER}'],
    ];

    for (const [reset, format] of ok) {
        it(`allows ${reset} with ${format}`, () => {
            assert.equal(resetRuleIssue(reset, format), null);
            assert.doesNotThrow(() => assertResetMatchesFormat(reset, format));
        });
    }

    for (const [reset, format] of bad) {
        it(`refuses ${reset} with ${format}`, () => {
            assert.notEqual(resetRuleIssue(reset, format), null);
            assert.throws(
                () => assertResetMatchesFormat(reset, format),
                DocumentFormatError,
            );
        });
    }

    it('explains what is missing rather than just failing', () => {
        const issue = resetRuleIssue('monthly', '{PREFIX}-{NUMBER}');
        assert.ok(issue?.includes('{MONTH}'), issue ?? '');
        assert.ok(issue?.includes('{YEAR}'), issue ?? '');
    });
});

describe('periodKeyFor — boundaries', () => {
    it('buckets each rule correctly', () => {
        assert.equal(periodKeyFor('never', NOW), '');
        assert.equal(periodKeyFor('yearly', NOW), '2026');
        assert.equal(periodKeyFor('monthly', NOW), '2026-08');
        assert.equal(periodKeyFor('daily', NOW), '2026-08-09');
    });

    it('changes across a year boundary and not within one', () => {
        const dec31 = new Date(2026, 11, 31, 23, 59);
        const jan01 = new Date(2027, 0, 1, 0, 1);
        assert.equal(periodKeyFor('yearly', dec31), '2026');
        assert.equal(periodKeyFor('yearly', jan01), '2027');
        assert.equal(
            periodKeyFor('yearly', new Date(2026, 0, 1)),
            periodKeyFor('yearly', dec31),
        );
    });

    it('changes across a month boundary and not within one', () => {
        const aug31 = new Date(2026, 7, 31);
        const sep01 = new Date(2026, 8, 1);
        assert.equal(periodKeyFor('monthly', aug31), '2026-08');
        assert.equal(periodKeyFor('monthly', sep01), '2026-09');
        assert.equal(periodKeyFor('monthly', new Date(2026, 7, 1)), '2026-08');
    });

    it('changes across a day boundary', () => {
        assert.equal(periodKeyFor('daily', new Date(2026, 7, 9, 23, 59)), '2026-08-09');
        assert.equal(periodKeyFor('daily', new Date(2026, 7, 10, 0, 0)), '2026-08-10');
    });

    it('never-reset keeps one bucket forever', () => {
        assert.equal(periodKeyFor('never', new Date(2026, 0, 1)), '');
        assert.equal(periodKeyFor('never', new Date(2099, 11, 31)), '');
    });
});

describe('rendering across period boundaries', () => {
    it('a yearly-reset format changes year and restarts at 1', () => {
        const format = '{PREFIX}-{YEAR}-{NUMBER}';
        const dec = renderDocumentNumber(
            format,
            ctx({ sequence: 412, now: new Date(2026, 11, 31) }),
        );
        const jan = renderDocumentNumber(
            format,
            ctx({ sequence: 1, now: new Date(2027, 0, 1) }),
        );
        assert.equal(dec, 'SO-2026-000412');
        assert.equal(jan, 'SO-2027-000001');
        assert.notEqual(dec, jan);
    });

    it('a monthly-reset format keeps August and September distinct at number 1', () => {
        const format = '{PREFIX}-{YEAR}-{MONTH}-{NUMBER}';
        const aug = renderDocumentNumber(format, ctx({ now: new Date(2026, 7, 31) }));
        const sep = renderDocumentNumber(format, ctx({ now: new Date(2026, 8, 1) }));
        assert.equal(aug, 'SO-2026-08-000001');
        assert.equal(sep, 'SO-2026-09-000001');
        assert.notEqual(aug, sep);
    });
});

describe('effectiveNextValue — what will REALLY be issued next', () => {
    const base = { next_value: 58, now: NOW };

    it('never-reset always hands back the raw counter', () => {
        assert.equal(
            effectiveNextValue({ ...base, reset_rule: 'never', period_key: '' }),
            58,
        );
        assert.equal(
            effectiveNextValue({ ...base, reset_rule: 'never', period_key: '1999' }),
            58,
        );
    });

    it('keeps counting when the stored period is current', () => {
        assert.equal(
            effectiveNextValue({ ...base, reset_rule: 'yearly', period_key: '2026' }),
            58,
        );
        assert.equal(
            effectiveNextValue({ ...base, reset_rule: 'monthly', period_key: '2026-08' }),
            58,
        );
    });

    it('restarts at 1 when the stored period is stale', () => {
        assert.equal(
            effectiveNextValue({ ...base, reset_rule: 'yearly', period_key: '2025' }),
            1,
        );
        assert.equal(
            effectiveNextValue({ ...base, reset_rule: 'monthly', period_key: '2026-07' }),
            1,
        );
        assert.equal(
            effectiveNextValue({ ...base, reset_rule: 'daily', period_key: '2026-08-08' }),
            1,
        );
    });

    it('restarts at 1 when a reset rule is switched ON for the first time', () => {
        // The stored period is '' because the sequence has always been
        // never-reset. This is the case that made the settings preview lie.
        assert.equal(
            effectiveNextValue({ ...base, reset_rule: 'yearly', period_key: '' }),
            1,
        );
    });
});
