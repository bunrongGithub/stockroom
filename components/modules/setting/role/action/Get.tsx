'use client';

import { FieldLabel } from '@/components/ui/FieldLabel';
import { SectionCard } from '@/components/ui/FormShell';
import { ReadonlyInput } from '@/components/ui/Readonly';
import { useRegisterModule } from '@/hook/useModule';
import { API } from '@/lib/constant';
import type { ModuleProps } from '@/lib/registry';
import { ArrowLeft, Loader2, Pencil, Save, ShieldCheck, UserCheck } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import ModuleAccessTree, {
    type AccessModule,
    type GrantMap,
} from '../ModuleAccessTree';

type RoleDetail = {
    id: number;
    name: string;
    description: string | null;
    is_active: boolean;
    created_at: string;
    company: { id: number; name: string } | null;
    grants: GrantMap;
};

const LIST_URL = '/setting/role';

export default function RoleView({
    currentPath,
    permission,
    currentPathActions,
}: ModuleProps) {
    useRegisterModule({
        actionModules: currentPathActions,
        permission,
        modulePath: currentPath.path,
    });

    const params = useParams();
    const id = Number(
        Array.isArray(params.slug) ? params.slug.at(-2) : params.slug,
    );

    const [role, setRole] = useState<RoleDetail | null>(null);
    const [modules, setModules] = useState<AccessModule[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Same two loads as the editor — the detail page renders the identical
    // access tree, so it needs the same module list to key the grants against.
    useEffect(() => {
        if (!id) return;
        let active = true;
        setLoading(true);
        Promise.all([
            fetch(`${API.setting.role.root}/${id}`),
            fetch(API.setting.module.tree),
        ])
            .then(async ([roleRes, modRes]) => {
                if (!active) return;
                const roleJson = await roleRes.json();
                const modJson = await modRes.json();
                setRole((roleJson.data ?? roleJson) as RoleDetail);
                setModules((modJson.data ?? []) as AccessModule[]);
            })
            .catch(() => active && setError('Failed to load the role.'))
            .finally(() => active && setLoading(false));
        return () => {
            active = false;
        };
    }, [id]);

    if (loading) {
        return (
            <div className="flex items-center justify-center gap-2 py-20 font-mono text-xs text-slate-400">
                <Loader2 size={16} className="animate-spin" /> Loading…
            </div>
        );
    }

    if (error || !role) {
        return (
            <p className="py-10 text-center font-mono text-xs text-rose-500">
                {error || 'Role not found.'}
            </p>
        );
    }

    const grantedModules = Object.values(role.grants ?? {}).filter(
        (a) => a.length > 0,
    ).length;

    return (
        <div className="space-y-4 font-mono text-xs">
            {/* Header — mirrors the editor's back link, title and button pair */}
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <Link
                        href={LIST_URL}
                        className="inline-flex items-center gap-2 text-slate-500 transition-colors hover:text-slate-700"
                    >
                        <ArrowLeft size={16} /> Back
                    </Link>
                    <h2 className="mt-3 flex items-center gap-3 text-2xl font-bold text-slate-800 md:text-3xl">
                        <ShieldCheck className="text-[#1a9e52]" />
                        {role.name}
                        <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                role.is_active
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-slate-100 text-slate-500'
                            }`}
                        >
                            {role.is_active ? 'Active' : 'Inactive'}
                        </span>
                    </h2>
                </div>
                <div className="flex items-center gap-2">
                    <Link
                        href={LIST_URL}
                        className="rounded-xl border border-slate-200 px-4 py-2.5 text-slate-600 transition-colors hover:bg-slate-50"
                    >
                        Discard
                    </Link>
                    {permission.can_update && (
                        <Link
                            href={`${LIST_URL}/${role.id}/update`}
                            className="flex items-center justify-center gap-2 rounded-xl bg-[#1a9e52] px-4 py-2.5 font-semibold text-white transition-colors hover:bg-[#158042]"
                        >
                            <Save size={16} /> Save
                        </Link>
                    )}
                </div>
            </div>

            <SectionCard icon={<UserCheck size={13} />} title="Role Information">
                <div className="grid gap-4 lg:grid-cols-2">
                    <div>
                        <FieldLabel>Name</FieldLabel>
                        <ReadonlyInput value={role.name} />
                    </div>
                    <div>
                        <FieldLabel>Description</FieldLabel>
                        <ReadonlyInput value={role.description ?? ''} />
                    </div>
                    <div>
                        <FieldLabel>Company</FieldLabel>
                        <ReadonlyInput value={role.company?.name ?? ''} />
                    </div>
                    <div>
                        <FieldLabel>Created</FieldLabel>
                        <ReadonlyInput
                            value={new Date(role.created_at).toLocaleDateString(
                                'en-GB',
                                {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric',
                                },
                            )}
                        />
                    </div>
                </div>
            </SectionCard>

            <SectionCard
                icon={<ShieldCheck size={13} />}
                title={`Module Access Rights (${grantedModules} ${
                    grantedModules === 1 ? 'module' : 'modules'
                })`}
            >
                <ModuleAccessTree
                    modules={modules}
                    grants={role.grants ?? {}}
                    onChangeAction={() => {}}
                    readOnly
                />
            </SectionCard>
        </div>
    );
}
