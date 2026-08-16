import { getRequestContext } from '@/lib/request-context';
import { ApiError, ApiResponseSuccess } from '@/service/core/api-response';
import { PERMISSIONS, requirePermission } from '@/service/core/authz';
import { CompanySettingsRepository } from '@/service/apps/setting/repo/company-settings';
import {
    THEME_PRESETS,
    sanitizeThemeTokens,
    type ThemePresetId,
} from '@/service/core/theme/tokens';
import { NextRequest } from 'next/server';
import { z } from 'zod';

/**
 * Company theme configuration.
 *
 * Tenant scoping is structural, not checked: none of these handlers accepts a
 * company id. The company is whatever the verified session says it is, so
 * "read/update another company's theme" is not an authorization failure to
 * catch — it is a request that cannot be expressed.
 *
 * Authorization reuses setting.company.view / .update rather than inventing a
 * company.theme.* permission. The theme IS company configuration, it is edited
 * on the company screen, and a new permission would mean a new modules row plus
 * a grant backfill for every existing role — new surface area, no new control.
 */

const repo = () => CompanySettingsRepository.getInstance();

const presetIds = THEME_PRESETS.map((p) => p.id) as [ThemePresetId, ...ThemePresetId[]];

/**
 * `tokens` is intentionally a loose record here and is narrowed by
 * sanitizeThemeTokens, which drops unknown keys and rejects anything that is
 * not a 6-digit hex colour. Declaring each token in the schema would duplicate
 * the token catalog and let the two drift.
 */
const updateThemeSchema = z.object({
    preset: z.enum(presetIds).optional(),
    tokens: z.record(z.string(), z.unknown()).optional(),
});

// GET /api/setting/company/theme — the caller's own company theme.
export async function GET(request: NextRequest) {
    try {
        const ctx = getRequestContext(request);
        await requirePermission(ctx, PERMISSIONS.setting.company.view, { req: request });
        const data = await repo().getTheme(ctx);
        return new ApiResponseSuccess({ data }).toResponse();
    } catch (error) {
        if (error instanceof ApiError) return error.toResponse();
        return new ApiError('Unexpected error', 500).toResponse();
    }
}

// PUT /api/setting/company/theme — replace the theme.
export async function PUT(request: NextRequest) {
    try {
        const ctx = getRequestContext(request);
        await requirePermission(ctx, PERMISSIONS.setting.company.update, { req: request });

        const parsed = updateThemeSchema.safeParse(await request.json());
        if (!parsed.success) {
            throw new ApiError('Invalid theme payload', 400, 'VALIDATION_ERROR');
        }

        // Reject rather than silently drop: a colour the admin typed that we
        // refuse to store should come back as an error, not vanish on save.
        const requested = parsed.data.tokens ?? {};
        const accepted = sanitizeThemeTokens(requested);
        const rejected = Object.keys(requested).filter(
            (k) => !(k in accepted) && requested[k] !== undefined,
        );
        if (rejected.length > 0) {
            throw new ApiError(
                `Invalid colour value for: ${rejected.join(', ')}. Use a 6-digit hex colour such as #2563EB.`,
                400,
                'INVALID_COLOR',
            );
        }

        const data = await repo().updateTheme(ctx, {
            preset: parsed.data.preset,
            tokens: accepted,
        });
        return new ApiResponseSuccess({ data }).toResponse();
    } catch (error) {
        if (error instanceof ApiError) return error.toResponse();
        return new ApiError('Unexpected error', 500).toResponse();
    }
}

// DELETE /api/setting/company/theme — back to the ERP default.
export async function DELETE(request: NextRequest) {
    try {
        const ctx = getRequestContext(request);
        await requirePermission(ctx, PERMISSIONS.setting.company.update, { req: request });
        const data = await repo().resetTheme(ctx);
        return new ApiResponseSuccess({ data }).toResponse();
    } catch (error) {
        if (error instanceof ApiError) return error.toResponse();
        return new ApiError('Unexpected error', 500).toResponse();
    }
}
