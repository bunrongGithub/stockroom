import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
    assertTransition,
    canTransition,
    isSerialStatus,
} from '../service/apps/inventory/serial/lifecycle.ts';
import {
    needsSequence,
    renderSerials,
    sanitizeCode,
    sequenceScopeKey,
    type SerialGenerationConfig,
} from '../service/apps/inventory/serial/strategies.ts';

const NOW = new Date('2026-07-18T10:00:00');

function cfg(over: Partial<SerialGenerationConfig> = {}): SerialGenerationConfig {
    return {
        strategy: 'sequential',
        prefix: '',
        suffix: '',
        seq_length: 8,
        start_number: 1,
        reset_rule: 'never',
        pattern: null,
        ...over,
    };
}

describe('serial lifecycle', () => {
    it('allows the documented transitions', () => {
        assert.ok(canTransition('available', 'sold'));
        assert.ok(canTransition('sold', 'returned'));
        assert.ok(canTransition('sold', 'available')); // reversal
        assert.ok(canTransition('available', 'reserved'));
        assert.ok(canTransition('reserved', 'available'));
        assert.ok(canTransition('transferred', 'available'));
    });

    it('rejects illegal transitions', () => {
        assert.equal(canTransition('scrapped', 'available'), false);
        assert.equal(canTransition('removed', 'sold'), false);
        assert.equal(canTransition('available', 'returned'), false);
        assert.throws(() => assertTransition('scrapped', 'available'));
    });

    it('recognizes valid statuses', () => {
        assert.ok(isSerialStatus('available'));
        assert.ok(isSerialStatus('inactive'));
        assert.equal(isSerialStatus('bogus'), false);
    });
});

describe('serial generation strategies', () => {
    it('sequential pads to the configured length from the block start', () => {
        const out = renderSerials(cfg(), 3, 41, { now: NOW });
        assert.deepEqual(out, ['00000041', '00000042', '00000043']);
    });

    it('date_prefix embeds the generation date', () => {
        const out = renderSerials(
            cfg({ strategy: 'date_prefix', seq_length: 4 }),
            1,
            7,
            { now: NOW },
        );
        assert.deepEqual(out, ['202607180007']);
    });

    it('item_prefix uses the sanitized item code', () => {
        const out = renderSerials(
            cfg({ strategy: 'item_prefix', seq_length: 6 }),
            1,
            1,
            { now: NOW, itemCode: 'iP-16 Pro' },
        );
        assert.deepEqual(out, ['IP16PRO-000001']);
    });

    it('company/warehouse prefixes + literal prefix/suffix compose', () => {
        const out = renderSerials(
            cfg({
                strategy: 'warehouse_prefix',
                prefix: 'SN',
                suffix: 'X',
                seq_length: 3,
            }),
            1,
            9,
            { now: NOW, warehouseCode: 'WH01' },
        );
        assert.deepEqual(out, ['SNWH01-009X']);
    });

    it('random uses the injected rng and never needs a sequence', () => {
        const config = cfg({ strategy: 'random', seq_length: 8 });
        const out = renderSerials(config, 2, 1, {
            now: NOW,
            randomChar: () => 'A',
        });
        assert.deepEqual(out, ['AAAAAAAA', 'AAAAAAAA']);
        assert.equal(needsSequence(config), false);
        assert.equal(needsSequence(cfg()), true);
    });

    it('custom pattern renders arbitrary token orders', () => {
        const out = renderSerials(
            cfg({
                strategy: 'custom',
                pattern: '{PREFIX}{YY}{MM}-{SEQ}',
                prefix: 'ICASE-',
                seq_length: 5,
            }),
            1,
            123,
            { now: NOW },
        );
        assert.deepEqual(out, ['ICASE-2607-00123']);
    });

    it('custom strategy without a pattern throws', () => {
        assert.throws(() =>
            renderSerials(cfg({ strategy: 'custom', pattern: null }), 1, 1),
        );
    });

    it('sanitizeCode strips non-alphanumerics and uppercases', () => {
        assert.equal(sanitizeCode('iP-16 Pro'), 'IP16PRO');
        assert.equal(sanitizeCode(null), '');
    });
});

describe('sequence scope keys', () => {
    it('encodes reset periods', () => {
        assert.equal(sequenceScopeKey(cfg(), { now: NOW }), 'co|all');
        assert.equal(
            sequenceScopeKey(cfg({ reset_rule: 'yearly' }), { now: NOW }),
            'co|2026',
        );
        assert.equal(
            sequenceScopeKey(cfg({ reset_rule: 'monthly' }), { now: NOW }),
            'co|2026-07',
        );
        assert.equal(
            sequenceScopeKey(cfg({ reset_rule: 'daily' }), { now: NOW }),
            'co|2026-07-18',
        );
    });

    it('scopes per item / per warehouse for prefix strategies', () => {
        assert.equal(
            sequenceScopeKey(cfg({ strategy: 'item_prefix' }), {
                itemId: 12,
                now: NOW,
            }),
            'item:12|all',
        );
        assert.equal(
            sequenceScopeKey(
                cfg({ strategy: 'warehouse_prefix', reset_rule: 'monthly' }),
                { warehouseId: 3, now: NOW },
            ),
            'wh:3|2026-07',
        );
    });
});
