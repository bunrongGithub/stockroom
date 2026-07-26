'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { API } from '@/lib/constant';
import type {
    AnalyticsBucket,
    AnalyticsMetric,
    AnalyticsRangeKey,
    AnalyticsTimeseries,
} from '@/types/analytics';
import dayjs from 'dayjs';

export const RANGE_OPTIONS: { key: AnalyticsRangeKey; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'last_7_days', label: 'Last 7 Days' },
    { key: 'last_30_days', label: 'Last 30 Days' },
    { key: 'this_month', label: 'This Month' },
    { key: 'last_month', label: 'Last Month' },
    { key: 'this_year', label: 'This Year' },
];

/** Bucket start → short axis label. */
export function formatBucket(bucket: string, granularity: AnalyticsBucket) {
    const d = dayjs(bucket);
    if (granularity === 'hour') return d.format('HH:00');
    if (granularity === 'month') return d.format('MMM YYYY');
    return d.format('DD MMM');
}

/**
 * Fetches one analytics time-series and owns its independent range filter.
 * Stale responses are dropped via AbortController when the range changes.
 */
export function useAnalyticsSeries<P>(metric: AnalyticsMetric) {
    const [range, setRange] = useState<AnalyticsRangeKey>('last_7_days');
    const [series, setSeries] = useState<AnalyticsTimeseries<P> | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const abortRef = useRef<AbortController | null>(null);

    const load = useCallback(
        async (rangeKey: AnalyticsRangeKey) => {
            abortRef.current?.abort();
            const controller = new AbortController();
            abortRef.current = controller;
            setLoading(true);
            setError('');
            try {
                const res = await fetch(
                    `${API.dashboard.analytics(metric)}?range=${rangeKey}`,
                    { signal: controller.signal },
                );
                const json = await res.json();
                if (!res.ok) {
                    throw new Error(json.error ?? 'Failed to load analytics');
                }
                setSeries(json.data as AnalyticsTimeseries<P>);
                setLoading(false);
            } catch (e) {
                if (controller.signal.aborted) return;
                setError(e instanceof Error ? e.message : 'Failed to load analytics');
                setLoading(false);
            }
        },
        [metric],
    );

    useEffect(() => {
        load(range);
        return () => abortRef.current?.abort();
    }, [load, range]);

    return { range, setRange, series, loading, error, retry: () => load(range) };
}
