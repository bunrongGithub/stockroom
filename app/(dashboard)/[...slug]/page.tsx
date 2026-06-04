import { getSession } from '@/lib/auth';
import { resolveModuleByPath } from '@/lib/db/modules';
import { getModuleLoader } from '@/lib/module-registry';
import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';

interface Props {
    params: Promise<{ slug: string[] }>;
}

export default async function CatchAllModulePage({ params }: Props) {
    const { slug } = await params;

    const session = await getSession();
    if (!session) redirect('/login');

    const companyId = Number(session.companyId);
    if (isNaN(companyId)) redirect('/login');

    // Reconstruct the URL path from slug segments
    const path = '/' + slug.join('/');

    // Resolve module record + merged permissions from DB (server-side security check)
    const mod = await resolveModuleByPath(path, session.userId, companyId);

    if (!mod) notFound();

    if (!mod.permission.can_view) redirect('/unauthorized');

    // Load the React component from the registry
    const loader = getModuleLoader(mod.component);
    if (!loader) {
        console.error(`[CatchAllModulePage] No component registered for key: "${mod.component}"`);
        notFound();
    }

    const { default: ModuleComponent } = await loader();
    console.log(`[CatchAllModulePage] Loaded component for path "${path}" with permissions:`, mod.permission);
    return (
        <Suspense
            fallback={
                <div className="flex items-center justify-center h-64">
                    <div className="w-6 h-6 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
                </div>
            }
        >
            <ModuleComponent module={mod} permission={mod.permission} />
        </Suspense>
    );
}

export async function generateMetadata({ params }: Props) {
    const { slug } = await params;
    const label = slug[slug.length - 1]
        ?.replace(/-/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase()) ?? 'Module';
    return { title: label };
}
