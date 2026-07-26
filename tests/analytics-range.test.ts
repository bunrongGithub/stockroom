import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { resolveAnalyticsRange } from '../service/apps/dashboard/analytics/range.ts';

// Fixed clock: Saturday 2026-07-18.
const NOW = new Date('2026-07-18T10:30:00');

describe('resolveAnalyticsRange presets', () => {
    it('today → single day, hour buckets', () => {
        const r = resolveAnalyticsRange('today', undefined, undefined, NOW);
        assert.deepEqual(r, { from: '2026-07-18', to: '2026-07-18', bucket: 'hour' });
    });

    it('last_7_days → inclusive 7-day window, day buckets', () => {
        const r = resolveAnalyticsRange('last_7_days', undefined, undefined, NOW);
        assert.deepEqual(r, { from: '2026-07-12', to: '2026-07-18', bucket: 'day' });
    });

    it('last_30_days → inclusive 30-day window', () => {
        const r = resolveAnalyticsRange('last_30_days', undefined, undefined, NOW);
        assert.deepEqual(r, { from: '2026-06-19', to: '2026-07-18', bucket: 'day' });
    });

    it('this_month → month start through today', () => {
        const r = resolveAnalyticsRange('this_month', undefined, undefined, NOW);
        assert.deepEqual(r, { from: '2026-07-01', to: '2026-07-18', bucket: 'day' });
    });

    it('last_month → full previous month', () => {
        const r = resolveAnalyticsRange('last_month', undefined, undefined, NOW);
        assert.deepEqual(r, { from: '2026-06-01', to: '2026-06-30', bucket: 'day' });
    });

    it('this_year → year start through today, month buckets', () => {
        const r = resolveAnalyticsRange('this_year', undefined, undefined, NOW);
        assert.deepEqual(r, { from: '2026-01-01', to: '2026-07-18', bucket: 'month' });
    });
});

describe('resolveAnalyticsRange custom', () => {
    it('single day → hour buckets', () => {
        const r = resolveAnalyticsRange('custom', '2026-07-01', '2026-07-01', NOW);
        assert.equal(r.bucket, 'hour');
    });

    it('short span → day buckets', () => {
        const r = resolveAnalyticsRange('custom', '2026-05-01', '2026-07-01', NOW);
        assert.deepEqual(r, { from: '2026-05-01', to: '2026-07-01', bucket: 'day' });
    });

    it('long span → month buckets', () => {
        const r = resolveAnalyticsRange('custom', '2025-01-01', '2026-07-01', NOW);
        assert.equal(r.bucket, 'month');
    });

    it('rejects missing or malformed dates', () => {
        assert.throws(() => resolveAnalyticsRange('custom', undefined, undefined, NOW));
        assert.throws(() => resolveAnalyticsRange('custom', '01/07/2026', '2026-07-02', NOW));
    });

    it('rejects from after to', () => {
        assert.throws(() => resolveAnalyticsRange('custom', '2026-07-05', '2026-07-01', NOW));
    });
});
