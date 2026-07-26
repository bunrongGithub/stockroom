/**
 * Named date operators → concrete inclusive ranges. Pure (dayjs only);
 * `now` is injectable so tests can pin the clock.
 */

import dayjs, { type Dayjs } from 'dayjs';
import type { DateNamedOperator } from './types.ts';

export type DateRange = {
    /** Inclusive ISO start (startOf unit). */
    from: string;
    /** Inclusive ISO end (endOf unit). */
    to: string;
};

type Unit = 'day' | 'week' | 'month' | 'year';

const OPERATOR_UNITS: Record<DateNamedOperator, { unit: Unit; offset: number }> = {
    today: { unit: 'day', offset: 0 },
    yesterday: { unit: 'day', offset: -1 },
    this_week: { unit: 'week', offset: 0 },
    last_week: { unit: 'week', offset: -1 },
    this_month: { unit: 'month', offset: 0 },
    last_month: { unit: 'month', offset: -1 },
    this_year: { unit: 'year', offset: 0 },
    last_year: { unit: 'year', offset: -1 },
};

export function resolveDateRange(
    operator: DateNamedOperator,
    now: Dayjs = dayjs(),
): DateRange {
    const { unit, offset } = OPERATOR_UNITS[operator];
    const anchor = now.add(offset, unit);
    return {
        from: anchor.startOf(unit).toISOString(),
        to: anchor.endOf(unit).toISOString(),
    };
}

/** Whole-day range for a single calendar date (used for `eq` on date fields). */
export function resolveDayRange(value: string): DateRange | null {
    const day = dayjs(value);
    if (!day.isValid()) return null;
    return {
        from: day.startOf('day').toISOString(),
        to: day.endOf('day').toISOString(),
    };
}

/** Inclusive range spanning two calendar dates (used for `between` on date fields). */
export function resolveBetweenRange(fromValue: string, toValue: string): DateRange | null {
    const from = dayjs(fromValue);
    const to = dayjs(toValue);
    if (!from.isValid() || !to.isValid()) return null;
    return {
        from: from.startOf('day').toISOString(),
        to: to.endOf('day').toISOString(),
    };
}

export function isValidDate(value: string): boolean {
    return dayjs(value).isValid();
}
