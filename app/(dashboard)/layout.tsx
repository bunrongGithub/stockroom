import { getSession, toRequestContext } from '@/lib/auth';
import { getMenu } from '@/lib/modules-rpc';
import { getCompanyBrief } from '@/service/apps/base/company';
import { getCompanyTheme } from '@/service/apps/setting/theme';
import { fetchSuperUserFlag } from '@/service/core/base-repository';
import { themeToCss } from '@/service/core/theme/css';
import type { AppInitData } from '@/types/app';
import { redirect } from 'next/navigation';
import DashboardClient from './DashboardClient';

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await getSession();
    if (!session) redirect('/signin');

    const companyId = Number(session.companyId);
    if (isNaN(companyId)) redirect('/signin');

    const ctx = toRequestContext(session);

    // Loaded once on the server and shared with the catch-all page via React
    // `cache()` — the client no longer needs to call `/api/app/init` on mount.
    const [modules, company, isSuperUser, theme] = await Promise.all([
        getMenu(session.userId, companyId),
        getCompanyBrief(companyId),
        fetchSuperUserFlag(session.userId),
        getCompanyTheme(ctx),
    ]);

    const initialData: AppInitData = {
        profile: {
            userId: ctx.userId,
            companyId: ctx.companyId,
            role: ctx.role,
            email: ctx.email,
            isSuperUser,
        },
        modules,
        company,
    };

    /**
     * The company theme ships in the FIRST HTML response, not after a client
     * fetch — the tenant's colours are already resolved here, on the server,
     * from the same session that authorised the page. That is what avoids the
     * flash of default theme (§14): there is never a paint in which the wrong
     * colours are on screen.
     *
     * `themeToCss` emits only tokens that differ from the default and validates
     * every value as it serializes, so a company on the stock theme adds no
     * bytes and no value reaches the document that is not a literal hex colour.
     */
    const themeCss = themeToCss(theme.light);

    return (
        <>
            {themeCss && (
                <style id="company-theme" dangerouslySetInnerHTML={{ __html: themeCss }} />
            )}
            <DashboardClient initialData={initialData}>{children}</DashboardClient>
        </>
    );
}
