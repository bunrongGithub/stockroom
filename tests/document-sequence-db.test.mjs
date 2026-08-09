/**
 * Database behaviour of the document sequence core.
 *
 * Unlike the pure tests next door, these need Postgres — they exercise the
 * atomic allocator, the reset boundaries, and the one guarantee the old system
 * only ever asserted in a comment: that concurrent callers cannot be handed the
 * same number.
 *
 * Skips itself (rather than failing) when no local database is reachable, so
 * `npm test` still passes on a machine with the stack down.
 *
 *   node --test tests/document-sequence-db.test.mjs
 */
import { strict as assert } from 'node:assert';
import { after, before, describe, it } from 'node:test';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const DB =
    process.env.SUPABASE_DB_URL ??
    'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

/** Run SQL, return rows as arrays of column strings. */
async function sql(text) {
    const { stdout } = await run('psql', [DB, '-t', '-A', '-F', '|', '-v', 'ON_ERROR_STOP=1', '-c', text]);
    return stdout
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => line.split('|'));
}

async function one(text) {
    const rows = await sql(text);
    return rows[0]?.[0];
}

/**
 * Probed SYNCHRONOUSLY at module load, because node:test evaluates the `skip`
 * option when a test is DEFINED — before any before() hook has run — and it
 * wants a boolean. Passing a function there is always truthy, which silently
 * skips the whole file and reports a green run.
 */
const reachable = (() => {
    try {
        execFileSync('psql', [DB, '-t', '-A', '-c', 'SELECT 1'], {
            stdio: ['ignore', 'pipe', 'ignore'],
        });
        return true;
    } catch {
        console.log('  ⚠ local Postgres unreachable — database tests skipped');
        return false;
    }
})();

const COMPANY = 1;
/** A doc type used only by this file, so no real counter is disturbed. */
const T = (name) => `zz_test_${name}`;

before(async () => {
    if (reachable) {
        await sql(`DELETE FROM document_sequence WHERE doc_type LIKE 'zz_test_%'`);
    }
});

after(async () => {
    if (reachable) {
        await sql(`DELETE FROM document_sequence WHERE doc_type LIKE 'zz_test_%'`);
    }
});

const t = (name, fn) => it(name, { skip: !reachable }, fn);

describe('allocation', () => {
    t('lazy-seeds on first use and starts at 1', async () => {
        const dt = T('seed');
        const first = await one(
            `SELECT next_document_number(${COMPANY}, '${dt}', 'ZZ')`,
        );
        assert.equal(first, 'ZZ-000001');
    });

    t('hands out strictly sequential numbers', async () => {
        const dt = T('seq');
        const got = [];
        for (let i = 0; i < 5; i++) {
            got.push(await one(`SELECT next_document_number(${COMPANY}, '${dt}', 'SQ')`));
        }
        assert.deepEqual(got, [
            'SQ-000001', 'SQ-000002', 'SQ-000003', 'SQ-000004', 'SQ-000005',
        ]);
    });

    t('two document types in one company do not interfere', async () => {
        const a = T('iso_a');
        const b = T('iso_b');
        await one(`SELECT next_document_number(${COMPANY}, '${a}', 'AA')`);
        await one(`SELECT next_document_number(${COMPANY}, '${a}', 'AA')`);
        const bFirst = await one(`SELECT next_document_number(${COMPANY}, '${b}', 'BB')`);
        assert.equal(bFirst, 'BB-000001');
    });

    t('two companies on the same document type do not interfere', async () => {
        const dt = T('tenant');
        const other = Number(
            await one('SELECT id FROM company WHERE id <> 1 ORDER BY id LIMIT 1'),
        );
        await one(`SELECT next_document_number(1, '${dt}', 'TN')`);
        await one(`SELECT next_document_number(1, '${dt}', 'TN')`);
        const otherFirst = await one(
            `SELECT next_document_number(${other}, '${dt}', 'TN')`,
        );
        assert.equal(
            otherFirst,
            'TN-000001',
            'company B must start its own count, not continue company A',
        );
    });

    t('refuses to mint from a deactivated sequence', async () => {
        const dt = T('inactive');
        await one(`SELECT next_document_number(${COMPANY}, '${dt}', 'IN')`);
        await sql(
            `UPDATE document_sequence SET is_active = false
              WHERE company_id = ${COMPANY} AND doc_type = '${dt}'`,
        );
        await assert.rejects(
            () => one(`SELECT next_document_number(${COMPANY}, '${dt}', 'IN')`),
            /No active document sequence/,
            'a retired sequence must fail loudly, never silently mint',
        );
    });
});

describe('reset policies', () => {
    /** Force the stored period to look stale, then allocate. */
    async function allocateAfterRollover(dt, rule, format, stalePeriod) {
        await one(`SELECT next_document_number(${COMPANY}, '${dt}', 'RS')`);
        await sql(
            `UPDATE document_sequence
                SET reset_rule = '${rule}', format = '${format}',
                    next_value = 42, period_key = '${stalePeriod}'
              WHERE company_id = ${COMPANY} AND doc_type = '${dt}'`,
        );
        return one(`SELECT next_document_number(${COMPANY}, '${dt}', 'RS')`);
    }

    t('yearly restarts at 1 when the year rolls over', async () => {
        const out = await allocateAfterRollover(
            T('yearly'), 'yearly', '{PREFIX}-{YEAR}-{NUMBER}', '1999',
        );
        const year = await one(`SELECT to_char(now(),'YYYY')`);
        assert.equal(out, `RS-${year}-000001`);
    });

    t('monthly restarts at 1 when the month rolls over', async () => {
        const out = await allocateAfterRollover(
            T('monthly'), 'monthly', '{PREFIX}-{YEAR}-{MONTH}-{NUMBER}', '1999-01',
        );
        const ym = await one(`SELECT to_char(now(),'YYYY-MM')`);
        assert.equal(out, `RS-${ym}-000001`);
    });

    t('daily restarts at 1 when the day rolls over', async () => {
        const out = await allocateAfterRollover(
            T('daily'), 'daily', '{PREFIX}-{YEAR}{MONTH}{DAY}-{NUMBER}', '1999-01-01',
        );
        const ymd = await one(`SELECT to_char(now(),'YYYYMMDD')`);
        assert.equal(out, `RS-${ymd}-000001`);
    });

    t('does NOT restart within the same period', async () => {
        const dt = T('same_period');
        await one(`SELECT next_document_number(${COMPANY}, '${dt}', 'SP')`);
        await sql(
            `UPDATE document_sequence
                SET reset_rule = 'yearly', format = '{PREFIX}-{YEAR}-{NUMBER}',
                    period_key = to_char(now(),'YYYY'), next_value = 7
              WHERE company_id = ${COMPANY} AND doc_type = '${dt}'`,
        );
        const out = await one(`SELECT next_document_number(${COMPANY}, '${dt}', 'SP')`);
        const year = await one(`SELECT to_char(now(),'YYYY')`);
        assert.equal(out, `SP-${year}-000007`);
    });

    t('never-reset ignores the period entirely', async () => {
        const dt = T('never');
        await one(`SELECT next_document_number(${COMPANY}, '${dt}', 'NV')`);
        await sql(
            `UPDATE document_sequence SET next_value = 900, period_key = '1999'
              WHERE company_id = ${COMPANY} AND doc_type = '${dt}'`,
        );
        assert.equal(
            await one(`SELECT next_document_number(${COMPANY}, '${dt}', 'NV')`),
            'NV-000900',
        );
    });
});

describe('concurrency', () => {
    t('N simultaneous callers get N distinct numbers', async () => {
        const dt = T('race');
        const N = 40;

        await one(`SELECT next_document_number(${COMPANY}, '${dt}', 'RC')`);
        const startRow = await sql(
            `SELECT next_value FROM document_sequence
              WHERE company_id = ${COMPANY} AND doc_type = '${dt}'`,
        );
        const start = Number(startRow[0][0]);

        // Separate psql processes → separate connections → genuinely parallel
        // transactions contending for the same sequence row.
        const results = await Promise.all(
            Array.from({ length: N }, () =>
                one(`SELECT next_document_number(${COMPANY}, '${dt}', 'RC')`),
            ),
        );

        const unique = new Set(results);
        assert.equal(
            unique.size,
            N,
            `expected ${N} distinct numbers, got ${unique.size} — duplicates: ${
                results.filter((v, i) => results.indexOf(v) !== i).join(', ')
            }`,
        );

        const end = Number(
            (await sql(
                `SELECT next_value FROM document_sequence
                  WHERE company_id = ${COMPANY} AND doc_type = '${dt}'`,
            ))[0][0],
        );
        assert.equal(end - start, N, 'counter must advance by exactly N');

        // And the set must be exactly the contiguous block, no gaps.
        const numbers = results
            .map((s) => Number(s.split('-')[1]))
            .sort((a, b) => a - b);
        assert.deepEqual(
            numbers,
            Array.from({ length: N }, (_, i) => start + i),
            'allocated numbers must form one contiguous block',
        );
    });
});

describe('SQL and TypeScript renderers agree', () => {
    t('render_document_number matches renderDocumentNumber', async () => {
        const { renderDocumentNumber } = await import(
            '../service/core/document-format.ts'
        );

        const cases = [
            ['{PREFIX}-{YEAR}-{NUMBER}', 'SO', 6, 1],
            ['{PREFIX}/{YEAR}/{NUMBER}', 'INV', 6, 125],
            ['{PREFIX}-{YEAR}-{MONTH}-{NUMBER}', 'GRN', 4, 42],
            ['{PREFIX}-{NUMBER}', 'CS', 6, 999999],
            ['{PREFIX}-{YY}{MONTH}{DAY}-{NUMBER}', 'ADJ', 3, 7],
            ['{PREFIX}-{NUMBER}', 'X', 3, 1234567], // outgrows its padding
        ];

        // One clock for both sides, so a midnight tick cannot flake the test.
        const at = await one(`SELECT now()::text`);
        const jsNow = new Date(at.replace(' ', 'T').replace(/\+(\d\d)$/, '+$1:00'));

        for (const [format, prefix, padding, seq] of cases) {
            const fromSql = await one(
                `SELECT render_document_number('${format}', '${prefix}', ${padding}, ${seq}, '${at}'::timestamptz)`,
            );
            const fromTs = renderDocumentNumber(format, {
                prefix,
                sequence: seq,
                padding,
                now: jsNow,
            });
            assert.equal(fromSql, fromTs, `${format} / ${prefix} / ${seq}`);
        }
    });
});

describe('SQL and TypeScript agree on the RESET boundary', () => {
    /**
     * The companion to the renderer-agreement suite above, and it exists for a
     * concrete reason: the settings preview once read `next_value` directly and
     * promised SO-2026-000058 while the allocator was about to restart at 1.
     * effectiveNextValue() was written to mirror the CASE expression inside
     * allocate_document_number(); this pins the two together so neither can be
     * changed alone.
     */
    t('effectiveNextValue predicts the number the allocator actually issues', async () => {
        const { effectiveNextValue } = await import(
            '../service/core/document-format.ts'
        );

        const cases = [
            // [rule,      stored period,  format,                              stale?]
            ['never',   '',            '{PREFIX}-{NUMBER}',                     false],
            ['never',   '1999',        '{PREFIX}-{NUMBER}',                     false],
            ['yearly',  '1999',        '{PREFIX}-{YEAR}-{NUMBER}',              true],
            ['yearly',  '',            '{PREFIX}-{YEAR}-{NUMBER}',              true],
            ['monthly', '1999-01',     '{PREFIX}-{YEAR}-{MONTH}-{NUMBER}',      true],
            ['daily',   '1999-01-01',  '{PREFIX}-{YEAR}{MONTH}{DAY}-{NUMBER}',  true],
        ];

        for (const [rule, storedPeriod, format] of cases) {
            const dt = T(`agree_${rule}_${storedPeriod || 'blank'}`.replace(/-/g, '_'));
            const STORED_NEXT = 58;

            await one(`SELECT next_document_number(${COMPANY}, '${dt}', 'AG')`);
            await sql(
                `UPDATE document_sequence
                    SET reset_rule = '${rule}', format = '${format}',
                        next_value = ${STORED_NEXT}, period_key = '${storedPeriod}'
                  WHERE company_id = ${COMPANY} AND doc_type = '${dt}'`,
            );

            // One clock for both sides so a midnight tick cannot flake this.
            const at = await one(`SELECT now()::text`);
            const jsNow = new Date(
                at.replace(' ', 'T').replace(/\+(\d\d)$/, '+$1:00'),
            );

            const predicted = effectiveNextValue({
                reset_rule: rule,
                period_key: storedPeriod,
                next_value: STORED_NEXT,
                now: jsNow,
            });

            // Ask the database what it ACTUALLY hands out.
            const actual = Number(
                await one(
                    `SELECT allocated FROM allocate_document_number(${COMPANY}, '${dt}')`,
                ),
            );

            assert.equal(
                predicted,
                actual,
                `${rule} with stored period "${storedPeriod}": TypeScript predicted ${predicted}, Postgres issued ${actual}`,
            );
        }
    });

    t('a sequence outgrowing its padding is never truncated end to end', async () => {
        // The regression guard for lpad(text, len) silently dropping high
        // digits — which would have collided with an earlier document.
        const dt = T('outgrown');
        await one(`SELECT next_document_number(${COMPANY}, '${dt}', 'OG')`);
        await sql(
            `UPDATE document_sequence
                SET padding = 3, next_value = 1234567, format = '{PREFIX}-{NUMBER}'
              WHERE company_id = ${COMPANY} AND doc_type = '${dt}'`,
        );
        assert.equal(
            await one(`SELECT next_document_number(${COMPANY}, '${dt}')`),
            'OG-1234567',
        );
    });
});

describe('robustness', () => {
    t('a long document type does not overflow the derived prefix', async () => {
        // The fallback prefix is derived from the doc type, which may be much
        // longer than the prefix column. The VALUES row is built before the
        // ON CONFLICT is evaluated, so an overflow raises even for a sequence
        // that already exists and needs no insert.
        // Longer than prefix VARCHAR(20), still within doc_type VARCHAR(30).
        const dt = T('long_doc_type_name');
        assert.ok(dt.length > 20 && dt.length <= 30, `fixture length ${dt.length}`);

        const first = await one(`SELECT next_document_number(${COMPANY}, '${dt}')`);
        assert.match(first, /000001$/);

        // Second call: the row now exists, so this is the path that used to
        // raise despite having nothing to insert.
        const second = await one(`SELECT next_document_number(${COMPANY}, '${dt}')`);
        assert.match(second, /000002$/);
    });
});
