'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useRegisterModule } from '@/hook/useModule';
import type { ModuleProps } from '@/lib/registry';
import { companyApi } from '@/lib/api/company';
import type { Company as TCompany, CompanyStatus } from '@/types/setting/company';
import {
    Building2,
    FileWarning,
    Palette,
    ShieldCheck,
    Users,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import GeneralTab from './tabs/GeneralTab';
import BrandingTab from './tabs/BrandingTab';
import UsersTab from './tabs/UsersTab';
import RolesTab from './tabs/RolesTab';

function StatusBadge({ status }: { status: CompanyStatus }) {
    const map: Record<CompanyStatus, string> = {
        active: 'bg-emerald-100 text-emerald-800',
        inactive: 'bg-gray-100 text-gray-600',
        suspended: 'bg-rose-100 text-rose-800',
    };
    return (
        <span
            className={`inline-block rounded-full px-2.5 py-1 text-xs font-mono font-medium capitalize ${map[status] ?? map.inactive}`}
        >
            {status}
        </span>
    );
}

// Registered as `Company` — the administration center for the tenant company.
export default function Company({
    currentPath,
    permission,
    currentPathActions,
    initialData,
}: ModuleProps) {
    useRegisterModule({
        actionModules: currentPathActions,
        permission,
        modulePath: currentPath.path,
    });

    const [company, setCompany] = useState<TCompany | null>(
        (initialData as TCompany) || null,
    );
    const [error, setError] = useState('');
    const [toast, setToast] = useState('');

    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(() => setToast(''), 3000);
        return () => clearTimeout(t);
    }, [toast]);

    if (error || !company) {
        return (
            <div className="flex h-64 flex-col items-center justify-center gap-3">
                <FileWarning className="text-muted-foreground" size={40} />
                <p className="text-sm text-muted-foreground">
                    {error || 'Company not found.'}
                </p>
            </div>
        );
    }

    const canUpdate = !!permission?.can_update;

    return (
        <div className="space-y-5 font-mono text-xs">
            {toast && (
                <div className="fixed right-6 top-6 z-50 rounded-xl bg-emerald-600 px-4 py-3 text-xs text-white shadow-lg">
                    {toast}
                </div>
            )}

            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    {company.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={company.logo_url}
                            alt={company.name}
                            className="h-10 w-10 rounded-xl border border-slate-200 object-contain bg-white"
                        />
                    ) : (
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white">
                            <Building2 size={18} />
                        </span>
                    )}
                    <div>
                        <h1 className="text-xl font-bold text-slate-800">
                            {company.name}
                        </h1>
                        <p className="text-[10px] text-slate-400">
                            Company Administration
                        </p>
                    </div>
                    <StatusBadge status={company.status} />
                </div>
            </div>

            <Tabs defaultValue="general" className="w-full flex-col">
                <TabsList className="grid w-full max-w-xl grid-cols-4">
                    <TabsTrigger value="general">
                        <Building2 size={13} /> General
                    </TabsTrigger>
                    <TabsTrigger value="branding">
                        <Palette size={13} /> Branding
                    </TabsTrigger>
                    <TabsTrigger value="users">
                        <Users size={13} /> Users
                    </TabsTrigger>
                    <TabsTrigger value="roles">
                        <ShieldCheck size={13} /> Roles
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="general" className="w-full pt-3">
                    <GeneralTab
                        company={company}
                        canUpdate={canUpdate}
                        onSaved={(c) => {
                            setCompany(c);
                            setToast('Company information saved');
                        }}
                    />
                </TabsContent>
                <TabsContent value="branding" className="w-full pt-3">
                    <BrandingTab
                        company={company}
                        canUpdate={canUpdate}
                        onLogoChanged={(url) => {
                            setCompany({ ...company, logo_url: url });
                            setToast('Logo updated');
                        }}
                    />
                </TabsContent>
                <TabsContent value="users" className="w-full pt-3">
                    <UsersTab canManage={canUpdate} onToast={setToast} />
                </TabsContent>
                <TabsContent value="roles" className="w-full pt-3">
                    <RolesTab />
                </TabsContent>
            </Tabs>
        </div>
    );
}
