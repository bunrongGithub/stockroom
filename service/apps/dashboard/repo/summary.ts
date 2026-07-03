import { BaseRepository } from '@/service/core/base-repository';
import { ApiError } from '@/service/core/api-response';
import type { RequestContext } from '@/types/request-context';
import type { DashboardSummary } from '@/types/dashboard';

/**
 * Dashboard aggregation — a thin wrapper over the get_dashboard_summary
 * Postgres function so the whole homepage loads in ONE database round-trip.
 * All metric definitions live in SQL (single source of truth); this layer
 * only applies company scoping and the optional warehouse filter.
 */
export class DashboardRepository extends BaseRepository {
    private static instance: DashboardRepository;

    static getInstance(): DashboardRepository {
        if (!DashboardRepository.instance) {
            DashboardRepository.instance = new DashboardRepository();
        }
        return DashboardRepository.instance;
    }

    async getSummary(
        ctx: RequestContext,
        warehouseId?: number,
    ): Promise<DashboardSummary> {
        const { data, error } = await this.db.rpc('get_dashboard_summary', {
            p_company_id: Number(ctx.companyId),
            p_warehouse_id: warehouseId ?? null,
        });

        if (error) throw new ApiError(error.message, 500, 'DASHBOARD_ERROR');
        return data as DashboardSummary;
    }
}
