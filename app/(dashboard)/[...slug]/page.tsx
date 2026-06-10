import { getSession } from '@/lib/auth';
import { apiUrl } from '@/lib/constant';
import { fetchPaginatedData } from '@/lib/fetch';
import { resolveModuleByPath } from '@/lib/modules';
import { getModuleLoader } from '@/lib/registry';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';

interface Props {
    params: Promise<{ slug: string[] }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function Page({ params, searchParams }: Props) {
    const { slug } = await params;

    const _searchParams = await searchParams;

    const session = await getSession();
    if (!session) redirect('/login');

    const companyId = Number(session.companyId);
    if (isNaN(companyId)) redirect('/login');

    const path = '/' + slug.join('/');
    const resolved = await resolveModuleByPath(path, session.userId, companyId);

    if (!resolved) notFound();
    const { module, actionModules } = resolved;
    if (!module.permission.can_view) redirect('/unauthorized');

    // Load the React component from the registry
    const loader = getModuleLoader(module.component);
    if (!loader) {
        console.error(
            `[CatchAllModulePage] No component registered for key: "${module.component}"`,
        );
        notFound();
    }

    const { default: ModuleComponent } = await loader();

    let _responseInitailPageData = null;
    let _responsePageMeta = null;

    const isCreateRoute = path.endsWith('/create');

    const toApiUrl = apiUrl(path);
    console.log(`[CatchAllModulePage] Fetching initial data from: ${toApiUrl}`);
    if (!isCreateRoute) {
        try {
            const response = await fetchPaginatedData(toApiUrl, _searchParams);
            _responseInitailPageData = response.data;
            _responsePageMeta = response.meta;
        } catch (error) {
            console.error(
                '[CatchAllModulePage] Failed to fetch initial data:',
                error,
            );
        }
    }

    return (
        <Suspense
            fallback={
                <div className="flex items-center justify-center h-64">
                    <div className="w-6 h-6 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
                </div>
            }
        >
            <ModuleComponent
                module={module}
                permission={module.permission}
                initialData={_responseInitailPageData}
                initialMeta={_responsePageMeta}
                actionModules={actionModules}
            />
        </Suspense>
    );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params;
    const label =
        slug[slug.length - 1]
            ?.replace(/-/g, ' ')
            .replace(/\b\w/g, (c) => c.toUpperCase()) ?? 'Module';
    return { title: label };
}
