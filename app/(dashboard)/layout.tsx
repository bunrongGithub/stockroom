import { getSession, toRequestContext } from '@/lib/auth';
import { getMenu } from '@/lib/modules-rpc';
import type { AppInitData } from '@/types/app';
import { redirect } from 'next/navigation';
import DashboardClient from './DashboardClient';

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await getSession();
    if (!session) redirect('/login');

    const companyId = Number(session.companyId);
    if (isNaN(companyId)) redirect('/login');

    // Loaded once on the server and shared with the catch-all page via React
    // `cache()` — the client no longer needs to call `/api/app/init` on mount.
    const modules = await getMenu(session.userId, companyId);
    const ctx = toRequestContext(session);

    const initialData: AppInitData = {
        profile: {
            userId: ctx.userId,
            companyId: ctx.companyId,
            role: ctx.role,
            email: ctx.email,
        },
        modules,
    };

    return <DashboardClient initialData={initialData}>{children}</DashboardClient>;
}
