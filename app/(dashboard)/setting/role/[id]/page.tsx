import { getSession } from '@/lib/auth';
import { BASE_URL } from '@/lib/constant';
import { serverFetch } from '@/lib/fetch';
import RoleRead from '@/components/modules/setting/RoleRead';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

interface Props {
    params: Promise<{ id: string }>;
}

export default async function RoleReadPage({ params }: Props) {
    const { id } = await params;

    const session = await getSession();
    if (!session) redirect('/login');

    const res = await serverFetch(`${BASE_URL}/api/setting/role/${id}`);
    if (!res.ok) notFound();

    const { data } = await res.json();
    if (!data) notFound();

    return (
        <RoleRead
            role={data.role}
            permissions={data.permissions}
            allModules={data.allModules}
        />
    );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { id } = await params;
    return { title: `Role #${id}` };
}
