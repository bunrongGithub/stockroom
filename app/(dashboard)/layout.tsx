import { getSession, toRequestContext } from '@/lib/auth';
import { getMenu } from '@/lib/modules-rpc';
import { getCompanyBrief } from '@/service/apps/base/company';
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

    // Loaded once on the server and shared with the catch-all page via React
    // `cache()` — the client no longer needs to call `/api/app/init` on mount.
    const [modules, company] = await Promise.all([
        getMenu(session.userId, companyId),
        getCompanyBrief(companyId),
    ]);
    const ctx = toRequestContext(session);

    const initialData: AppInitData = {
        profile: {
            userId: ctx.userId,
            companyId: ctx.companyId,
            role: ctx.role,
            email: ctx.email,
        },
        modules,
        company,
    };

    return <DashboardClient initialData={initialData}>{children}</DashboardClient>;
}
