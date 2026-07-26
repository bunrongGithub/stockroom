import { BaseRepository } from '@/service/core/base-repository';
import { ApiError } from '@/service/core/api-response';
import type { RequestContext } from '@/types/request-context';
import type {
    AnalyticsMetric,
    AnalyticsRange,
    AnalyticsRangeKey,
    AnalyticsTimeseries,
    PaymentTimeseriesPoint,
    SalesTimeseriesPoint,
} from '@/types/analytics';
import { resolveAnalyticsRange } from './range';

/**
 * Dashboard analytics — thin wrapper over the get_dashboard_timeseries
 * Postgres function. All aggregation (SUM / COUNT / date_trunc / gap-fill)
 * lives in SQL; this layer resolves range presets and applies company
 * scoping. New chart metrics reuse getTimeseries with a new metric key —
 * add a branch to the SQL function, a point type, and a facade below.
 */
export class DashboardAnalyticsRepository extends BaseRepository {
    private static instance: DashboardAnalyticsRepository;

    static getInstance(): DashboardAnalyticsRepository {
        if (!DashboardAnalyticsRepository.instance) {
            DashboardAnalyticsRepository.instance = new DashboardAnalyticsRepository();
        }
        return DashboardAnalyticsRepository.instance;
    }

    async getTimeseries<P>(
        ctx: RequestContext,
        metric: AnalyticsMetric,
        range: AnalyticsRange,
    ): Promise<AnalyticsTimeseries<P>> {
        const { data, error } = await this.db.rpc('get_dashboard_timeseries', {
            p_company_id: Number(ctx.companyId),
            p_metric: metric,
            p_from: range.from,
            p_to: range.to,
            p_bucket: range.bucket,
        });

        if (error) throw new ApiError(error.message, 500, 'ANALYTICS_ERROR');
        return { metric, range, points: (data ?? []) as P[] };
    }
}

const repo = DashboardAnalyticsRepository.getInstance();

export const SalesAnalyticsService = {
    getTrend(
        ctx: RequestContext,
        rangeKey: AnalyticsRangeKey,
        from?: string,
        to?: string,
    ): Promise<AnalyticsTimeseries<SalesTimeseriesPoint>> {
        const range = resolveAnalyticsRange(rangeKey, from, to);
        return repo.getTimeseries<SalesTimeseriesPoint>(ctx, 'sales', range);
    },
};

export const PaymentAnalyticsService = {
    getTrend(
        ctx: RequestContext,
        rangeKey: AnalyticsRangeKey,
        from?: string,
        to?: string,
    ): Promise<AnalyticsTimeseries<PaymentTimeseriesPoint>> {
        const range = resolveAnalyticsRange(rangeKey, from, to);
        return repo.getTimeseries<PaymentTimeseriesPoint>(ctx, 'payments', range);
    },
};
