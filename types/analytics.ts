// Contract for GET /api/dashboard/analytics/[metric] — mirrors the JSONB
// returned by the Postgres fn get_dashboard_timeseries (server-side
// aggregation; one point per bucket, never raw transactions).

export type AnalyticsMetric = 'sales' | 'payments';

export type AnalyticsBucket = 'hour' | 'day' | 'month';

export type AnalyticsRangeKey =
    | 'today'
    | 'last_7_days'
    | 'last_30_days'
    | 'this_month'
    | 'last_month'
    | 'this_year'
    | 'custom';

export type AnalyticsRange = {
    /** ISO date (YYYY-MM-DD), inclusive. */
    from: string;
    to: string;
    bucket: AnalyticsBucket;
};

export type SalesTimeseriesPoint = {
    /** Bucket start (ISO timestamp, no offset). */
    bucket: string;
    /** POSTED invoice amount (billing source of truth). */
    invoiced: number;
    invoice_count: number;
    /** Order intake (non-cancelled sales orders). */
    orders: number;
    order_count: number;
};

export type PaymentTimeseriesPoint = {
    bucket: string;
    /** POSTED customer payments received. */
    received: number;
    count: number;
};

export type AnalyticsTimeseries<P> = {
    metric: AnalyticsMetric;
    range: AnalyticsRange;
    points: P[];
};
