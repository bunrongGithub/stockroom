'use client';

import type { PaymentTimeseriesPoint } from '@/types/analytics';
import AnalyticsChartCard from './AnalyticsChartCard';
import TrendLineChart from './TrendLineChart';
import { formatBucket, useAnalyticsSeries } from './useAnalyticsSeries';

// Payment trend: POSTED customer payments received per bucket. Single series
// (no legend — the title names it) with the payment count in the tooltip.
export default function PaymentTrendChart() {
    const { range, setRange, series, loading, error, retry } =
        useAnalyticsSeries<PaymentTimeseriesPoint>('payments');

    const points = series?.points ?? [];
    const empty = points.every((p) => p.received === 0);

    return (
        <AnalyticsChartCard
            title="Payments Trend"
            range={range}
            onRangeChange={setRange}
            loading={loading}
            error={error}
            empty={empty}
            emptyText="No payments received in this period."
            onRetry={retry}
        >
            <TrendLineChart
                labels={points.map((p) =>
                    formatBucket(p.bucket, series?.range.bucket ?? 'day'),
                )}
                series={[
                    {
                        label: 'Payments Received',
                        color: '#1a9e52',
                        values: points.map((p) => p.received),
                        fill: true,
                    },
                ]}
                tooltipFooter={(i) => {
                    const p = points[i];
                    if (!p) return '';
                    return `${p.count} payment${p.count === 1 ? '' : 's'}`;
                }}
            />
        </AnalyticsChartCard>
    );
}
