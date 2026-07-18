import dayjs from 'dayjs';
import type { AnalyticsRange, AnalyticsRangeKey } from '@/types/analytics';

/**
 * Local error so this module stays importable under `node --test`
 * (no next/server); the API route converts it into a 400 response.
 */
export class AnalyticsRangeError extends Error {
    constructor(message = 'Invalid date range') {
        super(message);
        this.name = 'AnalyticsRangeError';
    }
}

const DATE = 'YYYY-MM-DD';

/**
 * Resolve a preset range key into an inclusive {from, to} date pair plus the
 * bucket granularity the chart should use. Pure — `now` is injectable for
 * tests. 'custom' takes explicit from/to and auto-picks the bucket:
 * single day → hour, ≤ 92 days → day, otherwise → month.
 */
export function resolveAnalyticsRange(
    key: AnalyticsRangeKey,
    from?: string,
    to?: string,
    now: Date = new Date(),
): AnalyticsRange {
    const today = dayjs(now);

    switch (key) {
        case 'today':
            return { from: today.format(DATE), to: today.format(DATE), bucket: 'hour' };
        case 'last_7_days':
            return { from: today.subtract(6, 'day').format(DATE), to: today.format(DATE), bucket: 'day' };
        case 'last_30_days':
            return { from: today.subtract(29, 'day').format(DATE), to: today.format(DATE), bucket: 'day' };
        case 'this_month':
            return { from: today.startOf('month').format(DATE), to: today.format(DATE), bucket: 'day' };
        case 'last_month': {
            const prev = today.subtract(1, 'month');
            return { from: prev.startOf('month').format(DATE), to: prev.endOf('month').format(DATE), bucket: 'day' };
        }
        case 'this_year':
            return { from: today.startOf('year').format(DATE), to: today.format(DATE), bucket: 'month' };
        case 'custom': {
            const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
            if (!from || !to || !ISO_DATE.test(from) || !ISO_DATE.test(to)) {
                throw new AnalyticsRangeError('Invalid custom date range');
            }
            const f = dayjs(from);
            const t = dayjs(to);
            if (!f.isValid() || !t.isValid() || f.isAfter(t)) {
                throw new AnalyticsRangeError('Invalid custom date range');
            }
            const days = t.diff(f, 'day') + 1;
            const bucket = days <= 1 ? 'hour' : days <= 92 ? 'day' : 'month';
            return { from: f.format(DATE), to: t.format(DATE), bucket };
        }
        default:
            throw new AnalyticsRangeError(`Unknown range: ${key}`);
    }
}
