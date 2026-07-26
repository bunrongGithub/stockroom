import { ApiError } from '@/service/core/api-response';
import { BaseRepository } from '@/service/core/base-repository';
import type { RequestContext } from '@/types/request-context';

const TABLE = 'company_settings' as const;

export type CompanySettings = {
    company_id: number;
    default_sales_warehouse_id: number | null;
    default_sales_location_id: number | null;
    settings: Record<string, unknown>;
};

export type SalesSettings = {
    default_sales_warehouse_id: number | null;
    default_sales_warehouse_name: string | null;
    default_sales_location_id: number | null;
    default_sales_location_name: string | null;
};

export type UpdateSalesSettingsInput = {
    default_sales_warehouse_id?: number | null;
    default_sales_location_id?: number | null;
};

/**
 * Per-company settings. Today it carries the Sales Settings the cashier screen
 * reads (which warehouse and location a counter sale ships from) — the point
 * being that no warehouse is ever hardcoded in the Cash Sale flow. `settings`
 * is the jsonb escape hatch for future keys (tax, currency, promotions).
 */
export class CompanySettingsRepository extends BaseRepository {
    private static instance: CompanySettingsRepository;

    static getInstance(): CompanySettingsRepository {
        if (!CompanySettingsRepository.instance) {
            CompanySettingsRepository.instance = new CompanySettingsRepository();
        }
        return CompanySettingsRepository.instance;
    }

    /** The settings row, created on first read if the company has none yet. */
    async get(ctx: RequestContext): Promise<CompanySettings> {
        const companyId = Number(ctx.companyId);
        const { data, error } = await this.db
            .from(TABLE)
            .select('*')
            .eq('company_id', companyId)
            .maybeSingle();
        if (error) throw new ApiError(error.message, 500);
        if (data) return data as CompanySettings;

        const { data: created, error: insErr } = await this.db
            .from(TABLE)
            .insert({ company_id: companyId })
            .select('*')
            .single();
        if (insErr) throw new ApiError(insErr.message, 500);
        return created as CompanySettings;
    }

    /** Sales settings with resolved names, for the settings screen + register. */
    async getSalesSettings(ctx: RequestContext): Promise<SalesSettings> {
        const settings = await this.get(ctx);

        const [warehouse, location] = await Promise.all([
            settings.default_sales_warehouse_id
                ? this.db
                      .from('warehouse')
                      .select('id, name')
                      .eq('id', settings.default_sales_warehouse_id)
                      .maybeSingle()
                : Promise.resolve({ data: null }),
            settings.default_sales_location_id
                ? this.db
                      .from('warehouse_location')
                      .select('id, name')
                      .eq('id', settings.default_sales_location_id)
                      .maybeSingle()
                : Promise.resolve({ data: null }),
        ]);

        return {
            default_sales_warehouse_id: settings.default_sales_warehouse_id,
            default_sales_warehouse_name: warehouse.data?.name ?? null,
            default_sales_location_id: settings.default_sales_location_id,
            default_sales_location_name: location.data?.name ?? null,
        };
    }

    async updateSalesSettings(
        ctx: RequestContext,
        input: UpdateSalesSettingsInput,
    ): Promise<SalesSettings> {
        const companyId = Number(ctx.companyId);
        await this.get(ctx); // ensure the row exists

        if (input.default_sales_warehouse_id) {
            await this.assertOwned(
                'warehouse',
                input.default_sales_warehouse_id,
                companyId,
            );
        }
        // A location must belong to the warehouse being defaulted to, or the
        // register would look for stock in a location the warehouse doesn't own.
        if (input.default_sales_location_id) {
            const { data: loc, error } = await this.db
                .from('warehouse_location')
                .select('id, warehouse_id')
                .eq('id', input.default_sales_location_id)
                .maybeSingle();
            if (error) throw new ApiError(error.message, 500);
            if (!loc) throw new ApiError('Location not found', 404);
            if (
                input.default_sales_warehouse_id &&
                loc.warehouse_id !== input.default_sales_warehouse_id
            ) {
                throw new ApiError(
                    'The default sales location must belong to the default sales warehouse.',
                    400,
                    'LOCATION_MISMATCH',
                );
            }
            await this.assertOwned('warehouse', loc.warehouse_id, companyId);
        }

        const { error } = await this.db
            .from(TABLE)
            .update({
                ...(input.default_sales_warehouse_id !== undefined && {
                    default_sales_warehouse_id: input.default_sales_warehouse_id,
                }),
                ...(input.default_sales_location_id !== undefined && {
                    default_sales_location_id: input.default_sales_location_id,
                }),
            })
            .eq('company_id', companyId);
        if (error) throw new ApiError(error.message, 500);

        return this.getSalesSettings(ctx);
    }

    /** Cross-tenant guard: the referenced row must belong to this company. */
    private async assertOwned(
        table: 'warehouse',
        id: number,
        companyId: number,
    ): Promise<void> {
        const { data, error } = await this.db
            .from(table)
            .select('id')
            .eq('id', id)
            .eq('company_id', companyId)
            .maybeSingle();
        if (error) throw new ApiError(error.message, 500);
        if (!data) throw new ApiError(`${table} not found`, 404);
    }
}
