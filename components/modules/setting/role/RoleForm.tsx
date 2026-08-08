'use client';

import {
    EditableInput,
    EditableTextarea,
    FieldLabel,
} from '@/components/ui/FieldLabel';
import { SectionCard } from '@/components/ui/FormShell';
import { Switch } from '@/components/ui/switch';
import { API } from '@/lib/constant';
import {
    AlertCircle,
    ArrowLeft,
    Loader2,
    Save,
    ShieldCheck,
    UserCheck,
    X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import ModuleAccessTree, {
    type AccessModule,
    type GrantMap,
} from './ModuleAccessTree';

export type RoleFormInitial = {
    id: number;
    name: string;
    description: string | null;
    is_active: boolean;
    grants: GrantMap;
};

const LIST_URL = '/setting/role';

export default function RoleForm({
    mode,
    roleId,
}: {
    mode: 'create' | 'edit';
    roleId?: number;
}) {
    const router = useRouter();

    const [modules, setModules] = useState<AccessModule[]>([]);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [isActive, setIsActive] = useState(true);
    const [grants, setGrants] = useState<GrantMap>({});

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    // The tree and (in edit mode) the role load together so the editor never
    // renders half-populated — grants keyed on module ids are meaningless
    // without the modules they point at.
    useEffect(() => {
        let active = true;
        setLoading(true);
        const requests: [Promise<Response>, Promise<Response> | null] = [
            fetch(API.setting.module.tree),
            mode === 'edit' && roleId
                ? fetch(`${API.setting.role.root}/${roleId}`)
                : null,
        ];

        Promise.all([requests[0], requests[1] ?? Promise.resolve(null)])
            .then(async ([modRes, roleRes]) => {
                if (!active) return;
                const modJson = await modRes.json();
                setModules((modJson.data ?? []) as AccessModule[]);

                if (roleRes) {
                    const roleJson = await roleRes.json();
                    const role = roleJson.data ?? roleJson;
                    setName(role.name ?? '');
                    setDescription(role.description ?? '');
                    setIsActive(role.is_active ?? true);
                    setGrants((role.grants ?? {}) as GrantMap);
                }
            })
            .catch(() => active && setError('Failed to load the role editor.'))
            .finally(() => active && setLoading(false));

        return () => {
            active = false;
        };
    }, [mode, roleId]);

    async function handleSave() {
        if (!name.trim()) {
            setError('Role name is required.');
            return;
        }
        setSaving(true);
        setError('');
        try {
            const payload = {
                name: name.trim(),
                description: description.trim() || null,
                is_active: isActive,
                // Only modules with at least one action travel; the server
                // replaces the role's grants with exactly this set.
                permissions: Object.entries(grants)
                    .filter(([, actions]) => actions.length > 0)
                    .map(([moduleId, actions]) => ({
                        module_id: Number(moduleId),
                        actions,
                    })),
            };

            const res = await fetch(
                mode === 'create'
                    ? API.setting.role.root
                    : `${API.setting.role.root}/${roleId}`,
                {
                    method: mode === 'create' ? 'POST' : 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                },
            );
            const json = await res.json();

            if (!res.ok) {
                const details = json.details as
                    | Record<string, string[]>
                    | undefined;
                setError(
                    details
                        ? Object.values(details).flat().join(', ')
                        : (json.error ?? 'Failed to save the role.'),
                );
                return;
            }

            const savedId = json.data?.id ?? json.id ?? roleId;
            router.push(savedId ? `${LIST_URL}/${savedId}/view` : LIST_URL);
            router.refresh();
        } catch {
            setError('An unexpected error occurred.');
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center gap-2 py-20 font-mono text-xs text-slate-400">
                <Loader2 size={16} className="animate-spin" /> Loading…
            </div>
        );
    }

    return (
        <div className="space-y-4 font-mono text-xs">
            {/* Header — back link, title, and the Discard / Save pair */}
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <Link
                        href={LIST_URL}
                        className="inline-flex items-center gap-2 text-slate-500 transition-colors hover:text-slate-700"
                    >
                        <ArrowLeft size={16} /> Back
                    </Link>
                    <h2 className="mt-3 flex items-center gap-2 text-2xl font-bold text-slate-800 md:text-3xl">
                        <ShieldCheck className="text-[#1a9e52]" />
                        {mode === 'create' ? 'Create' : `Update`}
                    </h2>
                </div>
                <div className="flex items-center gap-2">
                    <Link
                        href={LIST_URL}
                        className="rounded-xl border border-slate-200 px-4 py-2.5 text-slate-600 transition-colors hover:bg-slate-50"
                    >
                        Discard
                    </Link>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center justify-center gap-2 rounded-xl bg-[#1a9e52] px-4 py-2.5 font-semibold text-white transition-colors hover:bg-[#158042] disabled:opacity-50"
                    >
                        {saving ? (
                            <Loader2 className="animate-spin" size={16} />
                        ) : (
                            <Save size={16} />
                        )}
                        {saving ? 'Saving…' : 'Save'}
                    </button>
                </div>
            </div>

            {error && (
                <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                    <AlertCircle
                        size={18}
                        className="mt-0.5 shrink-0 text-red-500"
                    />
                    <p className="text-red-700">{error}</p>
                    <button
                        type="button"
                        onClick={() => setError('')}
                        className="ml-auto shrink-0 text-red-400 hover:text-red-600"
                    >
                        <X size={16} />
                    </button>
                </div>
            )}

            <SectionCard
                icon={<UserCheck size={13} />}
                title="Role Information"
            >
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                    <div>
                        <FieldLabel required>Name</FieldLabel>
                        <EditableInput
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Cashier, Warehouse Staff"
                        />
                    </div>
                    <div>
                        <FieldLabel>Description</FieldLabel>
                        <EditableTextarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={1}
                            placeholder="What this role is for..."
                        />
                    </div>
                    <div>
                        <FieldLabel>Active</FieldLabel>
                        <label className="flex min-h-11.5 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 shadow-sm">
                            <Switch
                                checked={isActive}
                                onCheckedChange={(v: boolean) => setIsActive(v)}
                            />
                            <span
                                className={
                                    isActive
                                        ? 'font-semibold text-[#1a9e52]'
                                        : 'text-slate-400'
                                }
                            >
                                {isActive ? 'Active' : 'Inactive'}
                            </span>
                        </label>
                    </div>
                </div>
            </SectionCard>

            <SectionCard
                icon={<ShieldCheck size={13} />}
                title="Module Access Rights"
            >
                <ModuleAccessTree
                    modules={modules}
                    grants={grants}
                    onChangeAction={setGrants}
                />
            </SectionCard>
        </div>
    );
}
