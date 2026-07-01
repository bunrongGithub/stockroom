import { getSession } from '@/lib/auth';
import { apiUrl } from '@/lib/constant';
import { fetchPaginatedData } from '@/lib/fetch';
import { getCurrentPath } from '@/lib/modules-rpc';
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

  const currentPathUrl = '/' + slug.join('/');
  const currentMenu = await getCurrentPath(
    currentPathUrl,
    session.userId,
    companyId,
  );

  if (!currentMenu) notFound();
  const { path, pathActions } = currentMenu;
  if (!path.permission.can_view) redirect('/unauthorized');

  // Load the React component from the registry
  const loader = getModuleLoader(path.component);
  if (!loader) {
    console.error(
      `[CatchAllModulePage] No component registered for key: "${path.component}"`,
    );
    notFound();
  }

  const { default: Component } = await loader();

  let _responseInitailPageData: any = null;
  let _responsePageMeta: any = null;

  if (path.is_initial_data) {
    console.log(`[Fetching data from ${path.component} on initial page....]`);

    console.log(`Current path url:: ${currentPathUrl}`);
    try {
      const response = await fetchPaginatedData(
        apiUrl(currentPathUrl),
        _searchParams,
      );
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
      <Component
        currentPath={path}
        permission={path.permission}
        initialData={_responseInitailPageData}
        initialMeta={_responsePageMeta}
        currentPathActions={pathActions}
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
