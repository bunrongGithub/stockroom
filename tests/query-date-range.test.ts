import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import dayjs from 'dayjs';

import {
    resolveBetweenRange,
    resolveDateRange,
    resolveDayRange,
} from '../service/core/query/date-range.ts';

// Wednesday, mid-month, mid-year — safe anchor for offset assertions.
const NOW = dayjs('2026-07-15T10:30:00.000Z');

function localIso(value: string): string {
    return dayjs(value).toISOString();
}

describe('resolveDateRange named operators', () => {
    it('today spans the current calendar day', () => {
        const range = resolveDateRange('today', NOW);
        assert.equal(range.from, NOW.startOf('day').toISOString());
        assert.equal(range.to, NOW.endOf('day').toISOString());
    });

    it('yesterday spans the previous calendar day', () => {
        const range = resolveDateRange('yesterday', NOW);
        assert.equal(range.from, NOW.subtract(1, 'day').startOf('day').toISOString());
        assert.equal(range.to, NOW.subtract(1, 'day').endOf('day').toISOString());
    });

    it('this_week / last_week align to week boundaries', () => {
        const thisWeek = resolveDateRange('this_week', NOW);
        assert.equal(thisWeek.from, NOW.startOf('week').toISOString());
        assert.equal(thisWeek.to, NOW.endOf('week').toISOString());

        const lastWeek = resolveDateRange('last_week', NOW);
        assert.equal(
            lastWeek.from,
            NOW.subtract(1, 'week').startOf('week').toISOString(),
        );
        assert.equal(
            lastWeek.to,
            NOW.subtract(1, 'week').endOf('week').toISOString(),
        );
        // last_week ends exactly where this_week begins (1ms gap).
        assert.equal(
            dayjs(lastWeek.to).add(1, 'millisecond').toISOString(),
            thisWeek.from,
        );
    });

    it('this_month / last_month align to month boundaries', () => {
        const thisMonth = resolveDateRange('this_month', NOW);
        assert.equal(thisMonth.from, NOW.startOf('month').toISOString());
        assert.equal(thisMonth.to, NOW.endOf('month').toISOString());

        const lastMonth = resolveDateRange('last_month', NOW);
        assert.equal(
            lastMonth.from,
            NOW.subtract(1, 'month').startOf('month').toISOString(),
        );
    });

    it('last_month handles month-length differences (Jan 31 anchor)', () => {
        const endOfJan = dayjs('2026-01-31T12:00:00.000Z');
        const range = resolveDateRange('last_month', endOfJan);
        // Anchor Jan 31 - 1 month → Dec 31 (dayjs clamps), Dec 1..Dec 31.
        assert.equal(
            range.from,
            endOfJan.subtract(1, 'month').startOf('month').toISOString(),
        );
        assert.equal(
            range.to,
            endOfJan.subtract(1, 'month').endOf('month').toISOString(),
        );
    });

    it('this_year / last_year align to year boundaries', () => {
        const thisYear = resolveDateRange('this_year', NOW);
        assert.equal(thisYear.from, NOW.startOf('year').toISOString());
        assert.equal(thisYear.to, NOW.endOf('year').toISOString());

        const lastYear = resolveDateRange('last_year', NOW);
        assert.equal(
            lastYear.from,
            NOW.subtract(1, 'year').startOf('year').toISOString(),
        );
        assert.equal(
            lastYear.to,
            NOW.subtract(1, 'year').endOf('year').toISOString(),
        );
    });

    it('week-start edge: an anchor on the first day of the week', () => {
        const weekStart = NOW.startOf('week');
        const range = resolveDateRange('this_week', weekStart);
        assert.equal(range.from, weekStart.toISOString());
    });
});

describe('resolveDayRange', () => {
    it('expands a calendar date to the whole day', () => {
        const range = resolveDayRange('2026-07-15');
        assert.ok(range);
        assert.equal(range.from, localIso('2026-07-15T00:00:00'));
        assert.equal(
            dayjs(range.to).diff(dayjs(range.from), 'hour'),
            23,
        );
    });

    it('rejects invalid dates', () => {
        assert.equal(resolveDayRange('not-a-date'), null);
    });
});

describe('resolveBetweenRange', () => {
    it('spans startOf(from) to endOf(to)', () => {
        const range = resolveBetweenRange('2026-01-01', '2026-01-31');
        assert.ok(range);
        assert.equal(range.from, localIso('2026-01-01T00:00:00'));
        assert.ok(dayjs(range.to).isAfter(dayjs(localIso('2026-01-31T23:00:00'))));
    });

    it('rejects invalid bounds', () => {
        assert.equal(resolveBetweenRange('bogus', '2026-01-31'), null);
        assert.equal(resolveBetweenRange('2026-01-01', 'bogus'), null);
    });
});
