import { cache } from 'react';
import { CompanySettingsRepository, EMPTY_THEME, type CompanyTheme } from './repo/company-settings';
import type { RequestContext } from '@/types/request-context';

/**
 * Server-side company theme resolution.
 *
 * Wrapped in React `cache()` for the same reason `fetchSuperUserFlag` is: the
 * dashboard layout and any server component in the same render both ask for the
 * theme, and this collapses that into a single query per request. That is the
 * whole caching story (§23) — no Redis, no TTL to invalidate, and nothing that
 * can serve a stale theme after a save, because the cache lives exactly as long
 * as one render.
 *
 * Reads never throw. A branding lookup failing is not a reason to fail the
 * page; the ERP simply renders in its default theme.
 */
export const getCompanyTheme = cache(
    async (ctx: RequestContext): Promise<CompanyTheme> => {
        try {
            return await CompanySettingsRepository.getInstance().getTheme(ctx);
        } catch {
            return EMPTY_THEME;
        }
    },
);
