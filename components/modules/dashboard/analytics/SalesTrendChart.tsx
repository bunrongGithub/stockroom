'use client';

import type { SalesTimeseriesPoint } from '@/types/analytics';
import AnalyticsChartCard from './AnalyticsChartCard';
import TrendLineChart from './TrendLineChart';
import { formatBucket, useAnalyticsSeries } from './useAnalyticsSeries';

// Sales trend: Posted Invoices (billed — the sales source of truth, matching
// the KPI definitions) vs Order Intake (non-cancelled orders placed). Both are
// amounts on ONE shared axis; document counts ride in the tooltip footer.
export default function SalesTrendChart() {
    const { range, setRange, series, loading, error, retry } =
        useAnalyticsSeries<SalesTimeseriesPoint>('sales');

    const points = series?.points ?? [];
    const empty = points.every((p) => p.invoiced === 0 && p.orders === 0);

    return (
        <AnalyticsChartCard
            title="Sales Trend"
            range={range}
            onRangeChange={setRange}
            loading={loading}
            error={error}
            empty={empty}
            emptyText="No sales in this period."
            onRetry={retry}
        >
            <TrendLineChart
                labels={points.map((p) =>
                    formatBucket(p.bucket, series?.range.bucket ?? 'day'),
                )}
                series={[
                    {
                        label: 'Posted Invoices',
                        color: '#1a9e52',
                        values: points.map((p) => p.invoiced),
                    },
                    {
                        label: 'Order Intake',
                        color: '#2a78d6',
                        values: points.map((p) => p.orders),
                    },
                ]}
                tooltipFooter={(i) => {
                    const p = points[i];
                    if (!p) return '';
                    return `${p.invoice_count} invoice${p.invoice_count === 1 ? '' : 's'} · ${p.order_count} order${p.order_count === 1 ? '' : 's'}`;
                }}
            />
        </AnalyticsChartCard>
    );
}
