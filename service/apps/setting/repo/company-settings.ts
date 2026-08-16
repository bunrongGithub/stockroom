import { ApiError } from '@/service/core/api-response';
import { BaseRepository } from '@/service/core/base-repository';
import {
    sanitizeThemeTokens,
    type PartialThemeTokens,
    type ThemePresetId,
} from '@/service/core/theme/tokens';
import type { RequestContext } from '@/types/request-context';

const TABLE = 'company_settings' as const;

/** The shape stored under `company_settings.settings.theme`. */
export type CompanyTheme = {
    /** Which preset the admin last picked, for the form's radio state. */
    preset: ThemePresetId;
    /**
     * Only the tokens this company overrides. Nested under `light` so a `dark`
     * sibling can be added later without a migration or a data rewrite — see
     * the dark-mode note in the Theme tab.
     */
    light: PartialThemeTokens;
};

export const EMPTY_THEME: CompanyTheme = { preset: 'default', light: {} };

/**
 * Read a theme out of the settings bag, tolerating every historical shape:
 * missing key, null, or a value written by an older/newer build. Anything
 * unrecognised degrades to "no overrides" rather than throwing — a malformed
 * branding record must never be able to take the ERP down.
 */
function readTheme(settings: unknown): CompanyTheme {
    if (!settings || typeof settings !== 'object') return EMPTY_THEME;
    const theme = (settings as Record<string, unknown>).theme;
    if (!theme || typeof theme !== 'object') return EMPTY_THEME;
    const raw = theme as Record<string, unknown>;
    return {
        preset:
            typeof raw.preset === 'string'
                ? (raw.preset as ThemePresetId)
                : 'default',
        light: sanitizeThemeTokens(raw.light),
    };
}

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

    /* ── Company theme ────────────────────────────────────────────────────
     * Tenant isolation is structural: every method reads companyId from the
     * request context and none of them accepts a company id argument, so there
     * is no parameter through which one tenant could name another's row.
     */

    /**
     * The company's saved overrides. Never throws for a company that has never
     * configured a theme — it returns an empty override set, which the token
     * layer resolves to the ERP default.
     */
    async getTheme(ctx: RequestContext): Promise<CompanyTheme> {
        const companyId = Number(ctx.companyId);
        const { data, error } = await this.db
            .from(TABLE)
            .select('settings')
            .eq('company_id', companyId)
            .maybeSingle();
        if (error) throw new ApiError(error.message, 500);
        return readTheme(data?.settings);
    }

    /**
     * Replace the company's theme. Values are re-sanitized here rather than
     * trusted from the caller: this is the last point before persistence, and
     * the repository should not depend on a route having validated correctly.
     */
    async updateTheme(
        ctx: RequestContext,
        input: { preset?: ThemePresetId; tokens?: PartialThemeTokens },
    ): Promise<CompanyTheme> {
        const companyId = Number(ctx.companyId);
        const current = await this.get(ctx); // ensures the row exists

        const theme: CompanyTheme = {
            preset: input.preset ?? readTheme(current.settings).preset,
            light: sanitizeThemeTokens(input.tokens ?? {}),
        };

        const { error } = await this.db
            .from(TABLE)
            .update(
                this.stampUpdate(ctx, {
                    settings: { ...(current.settings ?? {}), theme },
                }),
            )
            .eq('company_id', companyId);
        if (error) throw new ApiError(error.message, 500);
        return theme;
    }

    /** Drop the overrides so the company falls back to the ERP default. */
    async resetTheme(ctx: RequestContext): Promise<CompanyTheme> {
        return this.updateTheme(ctx, { preset: 'default', tokens: {} });
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
