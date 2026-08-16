'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AuditInformationCard } from '@/components/ui/AuditInformationCard';
import { useApp } from '@/context/AppContext';
import type { AuditMeta } from '@/types/audit';
import type { Company as TCompany, CompanyStatus } from '@/types/setting/company';
import {
    ArrowLeft,
    Building2,
    Paintbrush,
    Palette,
    ShieldCheck,
    Users,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import GeneralTab from './tabs/GeneralTab';
import BrandingTab from './tabs/BrandingTab';
import ThemeTab from './tabs/ThemeTab';
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

// The tabbed company overview, shown by the /setting/company/[id]/view action.
export default function CompanyDetail({
    initial,
    canUpdate,
}: {
    initial: TCompany;
    canUpdate: boolean;
}) {
    const router = useRouter();
    const { profile } = useApp();
    const [company, setCompany] = useState<TCompany>(initial);
    const [toast, setToast] = useState('');

    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(() => setToast(''), 3000);
        return () => clearTimeout(t);
    }, [toast]);

    // Member management (assign role / remove user) still operates on the
    // caller's own company only, so hide it when viewing another company.
    const isOwnCompany = Number(profile?.companyId) === company.id;

    return (
        <div className="space-y-5 font-mono text-xs">
            {toast && (
                <div className="fixed right-6 top-6 z-50 rounded-xl bg-emerald-600 px-4 py-3 text-xs text-white shadow-lg">
                    {toast}
                </div>
            )}

            <button
                type="button"
                onClick={() => router.push('/setting/company')}
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
                <ArrowLeft size={16} /> Back
            </button>

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
                {/* Theme is offered only on your OWN company. The theme API is
                    scoped to the session's company and takes no company id, so
                    a super admin editing another company's page would otherwise
                    be silently restyling their own tenant. */}
                <TabsList
                    className={`grid w-full ${isOwnCompany ? 'max-w-2xl grid-cols-5' : 'max-w-xl grid-cols-4'}`}
                >
                    <TabsTrigger value="general">
                        <Building2 size={13} /> General
                    </TabsTrigger>
                    <TabsTrigger value="branding">
                        <Palette size={13} /> Branding
                    </TabsTrigger>
                    {isOwnCompany && (
                        <TabsTrigger value="theme">
                            <Paintbrush size={13} /> Theme
                        </TabsTrigger>
                    )}
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
                {isOwnCompany && (
                    <TabsContent value="theme" className="w-full pt-3">
                        <ThemeTab canUpdate={canUpdate} />
                    </TabsContent>
                )}
                <TabsContent value="users" className="w-full pt-3">
                    <UsersTab
                        companyId={company.id}
                        canManage={canUpdate && isOwnCompany}
                        onToast={setToast}
                    />
                </TabsContent>
                <TabsContent value="roles" className="w-full pt-3">
                    <RolesTab />
                </TabsContent>
            </Tabs>

            <div className="mt-4">
                <AuditInformationCard audit={company as Partial<AuditMeta>} />
            </div>
        </div>
    );
}
