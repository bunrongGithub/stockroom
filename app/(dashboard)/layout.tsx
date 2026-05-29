'use client';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { PageActionContext } from '@/context/PageActionContext';
import { UserProfileProvider, useUserProfile } from '@/context/UserProfileContext';
import { Action, TMenuItem } from '@/types';
import { modulesList } from '@/utils/systemMenu';
import { ChevronDown, ChevronRight, Loader2, LogOut } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React, { useEffect, useState } from 'react';

function SidebarRole() {
    const profile = useUserProfile();
    const label = profile
        ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1)
        : 'Shop Manager';
    return <p className="text-[10px] text-gray-500">{label}</p>;
}

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const isActive = (href: string) =>
        pathname === href || (pathname.startsWith(href) && href !== '/');

    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    useEffect(() => {
        supabase.auth
            .getUser()
            .then(({ data: { user } }) =>
                setUserEmail(user?.email ?? 'មិនមានគណនី'),
            )
            .catch(() => setUserEmail('Error'));
    }, []);

    const [appConfig, setAppConfig] = useState({
        name: 'iCase',
        logo: '/icase.jpg',
    });

    useEffect(() => {
        const load = async () => {
            const { data } = await supabase
                .from('settings')
                .select('shop_name, logo')
                .limit(1)
                .single();
            if (data)
                setAppConfig({
                    name: data.shop_name || 'iCase Service',
                    logo: data.logo || '/icase.jpg',
                });
        };
        load();
        window.addEventListener('settingsUpdated', load);
        return () => window.removeEventListener('settingsUpdated', load);
    }, []);

    const [openModules, setOpenModules] = useState<Record<string, boolean>>({});
    const toggleModule = (href: string) =>
        setOpenModules((p) => ({ ...p, [href]: !(p[href] ?? false) }));

    const activeModule =
        modulesList.find(
            (m) =>
                isActive(m.href) ||
                m.menu?.some((i) => isActive(i.href)) ||
                m.menu?.some((i) => i.children?.some((c) => isActive(c.href))),
        ) ?? null;

    const configItems: TMenuItem[] =
        activeModule?.menu
            ?.filter((i) => i.type === 'configuration')
            .slice()
            .sort((a, b) => a.ordering - b.ordering) ?? [];

    const allItems: TMenuItem[] = activeModule?.menu ?? [];

    const activeItem: TMenuItem | null =
        allItems.find((i) => pathname === i.href) ??
        allItems.find(
            (i) =>
                isActive(i.href) || i.children?.some((c) => isActive(c.href)),
        ) ??
        null;

    const [actionList, setActionList] = useState<Action>(
        activeItem?.action ?? [],
    );

    useEffect(() => {
        setActionList(activeItem?.action ?? []);
    }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleLogout = async () => {
        setIsLoggingOut(true);
        try {
            await supabase.auth.signOut();
            window.location.href = '/login';
        } catch {
            setIsLoggingOut(false);
        }
    };

    const initials =
        userEmail && !['មិនមានគណនី', 'Error'].includes(userEmail)
            ? userEmail.substring(0, 2).toUpperCase()
            : 'AD';

    return (
        <UserProfileProvider>
            <div className="flex h-screen w-full overflow-hidden bg-gray-50 font-sans">
                {/* ═══════════════════ SIDEBAR ═══════════════════ */}
                <aside className="w-64 bg-gray-950 border-r border-gray-800 flex flex-col shrink-0">
                    {/* Brand */}
                    <div className="h-16 flex items-center gap-3 px-5 border-b border-gray-800/60 shrink-0">
                        <div className="bg-white p-0.5 rounded-lg w-9 h-9 shrink-0 overflow-hidden shadow">
                            <Image
                                src={appConfig.logo}
                                alt="Logo"
                                width={36}
                                height={36}
                                className="w-full h-full object-contain"
                            />
                        </div>
                        <div>
                            <h1 className="text-white font-bold text-sm leading-tight truncate max-w-36">
                                {appConfig.name}
                            </h1>
                            <p className="text-[9px] text-emerald-400/70 font-bold tracking-widest uppercase">
                                Management
                            </p>
                        </div>
                    </div>

                    {/* Module list */}
                    <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1 scrollbar-hide">
                        <p className="px-2 text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-2">
                            Modules
                        </p>

                        {modulesList.map((module) => {
                            const ModIcon = module.icon;
                            const moduleActive =
                                isActive(module.href) ||
                                module.menu?.some((i) => isActive(i.href)) ||
                                module.menu?.some((i) =>
                                    i.children?.some((c) => isActive(c.href)),
                                ) ||
                                false;

                            const menuItems =
                                module.menu
                                    ?.filter((i) => i.type === 'menu')
                                    .slice()
                                    .sort((a, b) => a.ordering - b.ordering) ??
                                [];

                            const isOpen =
                                openModules[module.href] ?? moduleActive;

                            return (
                                <div key={module.href}>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            toggleModule(module.href)
                                        }
                                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                                            ${
                                                moduleActive
                                                    ? 'bg-emerald-500/10 text-emerald-300'
                                                    : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'
                                            }`}
                                    >
                                        {ModIcon && (
                                            <ModIcon
                                                size={16}
                                                className={
                                                    moduleActive
                                                        ? 'text-emerald-400'
                                                        : 'text-gray-500'
                                                }
                                                strokeWidth={
                                                    moduleActive ? 2.5 : 2
                                                }
                                            />
                                        )}
                                        <span className="flex-1 text-left">
                                            {module.label}
                                        </span>
                                        {menuItems.length > 0 && (
                                            <ChevronDown
                                                size={14}
                                                className={`transition-transform ${isOpen ? 'rotate-180' : ''} ${moduleActive ? 'text-emerald-400' : 'text-gray-600'}`}
                                            />
                                        )}
                                    </button>

                                    {isOpen && menuItems.length > 0 && (
                                        <div className="ml-4 mt-0.5 space-y-0.5 border-l border-gray-800 pl-3">
                                            {menuItems.map((item) => {
                                                const menuActive =
                                                    isActive(item.href) ||
                                                    item.children?.some((c) =>
                                                        isActive(c.href),
                                                    );
                                                const subItems =
                                                    item.children
                                                        ?.filter(
                                                            (c) =>
                                                                c.type ===
                                                                'submenu',
                                                        )
                                                        .slice()
                                                        .sort(
                                                            (a, b) =>
                                                                a.ordering -
                                                                b.ordering,
                                                        ) ?? [];
                                                const subOpen =
                                                    openModules[item.href] ??
                                                    !!menuActive;

                                                return (
                                                    <div key={item.href}>
                                                        <div className="flex items-center">
                                                            <Link
                                                                href={item.href}
                                                                className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all
                                                                    ${
                                                                        menuActive
                                                                            ? 'bg-emerald-500/10 text-emerald-300 font-medium'
                                                                            : 'text-gray-500 hover:bg-gray-800/40 hover:text-gray-200'
                                                                    }`}
                                                            >
                                                                <span
                                                                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${menuActive ? 'bg-emerald-400' : 'bg-gray-700'}`}
                                                                />
                                                                {item.label}
                                                            </Link>
                                                            {subItems.length >
                                                                0 && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        toggleModule(
                                                                            item.href,
                                                                        )
                                                                    }
                                                                    className="p-1 text-gray-600 hover:text-gray-400"
                                                                >
                                                                    <ChevronRight
                                                                        size={
                                                                            12
                                                                        }
                                                                        className={`transition-transform ${subOpen ? 'rotate-90' : ''}`}
                                                                    />
                                                                </button>
                                                            )}
                                                        </div>

                                                        {subOpen &&
                                                            subItems.length >
                                                                0 && (
                                                                <div className="ml-3 mt-0.5 space-y-0.5 border-l border-gray-800/60 pl-3">
                                                                    {subItems.map(
                                                                        (
                                                                            sub,
                                                                        ) => {
                                                                            const subActive =
                                                                                isActive(
                                                                                    sub.href,
                                                                                );
                                                                            return (
                                                                                <Link
                                                                                    key={
                                                                                        sub.href
                                                                                    }
                                                                                    href={
                                                                                        sub.href
                                                                                    }
                                                                                    className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs transition-all
                                                                                ${
                                                                                    subActive
                                                                                        ? 'text-emerald-300 font-medium'
                                                                                        : 'text-gray-600 hover:text-gray-300'
                                                                                }`}
                                                                                >
                                                                                    <span className="w-1 h-1 rounded-full bg-current opacity-50" />
                                                                                    {
                                                                                        sub.label
                                                                                    }
                                                                                </Link>
                                                                            );
                                                                        },
                                                                    )}
                                                                </div>
                                                            )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <Separator className="bg-gray-800/60" />

                    {/* Profile & Logout */}
                    <div className="p-3 shrink-0">
                        <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-gray-800/50 transition group">
                            <div className="bg-linear-to-br from-emerald-600 to-emerald-400 text-white w-8 h-8 shrink-0 rounded-full flex items-center justify-center font-bold text-xs shadow">
                                {initials}
                            </div>
                            <div className="flex-1 overflow-hidden">
                                <p className="text-gray-200 text-xs font-semibold truncate group-hover:text-white">
                                    {userEmail ?? 'កំពុងផ្ទុក...'}
                                </p>
                                <SidebarRole />
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleLogout}
                                disabled={isLoggingOut}
                                title="Logout"
                                className="h-7 w-7 text-gray-600 hover:text-rose-400 hover:bg-rose-500/10"
                            >
                                {isLoggingOut ? (
                                    <Loader2
                                        size={15}
                                        className="animate-spin"
                                    />
                                ) : (
                                    <LogOut size={15} />
                                )}
                            </Button>
                        </div>
                    </div>
                </aside>

                {/* ═══════════════════ MAIN AREA ═══════════════════ */}
                <div className="flex flex-1 min-w-0 flex-col overflow-hidden">
                    {/* Top Navbar */}
                    <nav className="shrink-0 bg-gray-950 border-b border-gray-800/60">
                        <div className="flex h-14 items-center justify-between gap-4 px-6">
                            <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
                                {activeModule && (
                                    <span className="text-xs font-bold text-gray-500 uppercase tracking-widest pr-3 border-r border-gray-800 mr-2 shrink-0">
                                        {activeModule.label}
                                    </span>
                                )}
                                {configItems.length === 0 && (
                                    <span className="text-xs text-gray-700 italic">
                                        No configurations
                                    </span>
                                )}
                                {configItems.map((item) => {
                                    const CfgIcon = item.icon;
                                    const active = isActive(item.href);
                                    return (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0
                                                ${
                                                    active
                                                        ? 'bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/30'
                                                        : 'text-gray-500 hover:bg-gray-800/60 hover:text-gray-200'
                                                }`}
                                        >
                                            {CfgIcon && (
                                                <CfgIcon
                                                    size={13}
                                                    className={
                                                        active
                                                            ? 'text-emerald-400'
                                                            : 'text-gray-600'
                                                    }
                                                    strokeWidth={
                                                        active ? 2.5 : 2
                                                    }
                                                />
                                            )}
                                            {item.label}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    </nav>

                    {/* Page Content */}
                    <main className="flex-1 min-h-0 overflow-y-auto bg-gray-50">
                        <PageActionContext.Provider
                            value={{
                                actions: actionList,
                                setActions: setActionList,
                            }}
                        >
                            {children}
                        </PageActionContext.Provider>
                    </main>
                </div>
            </div>
        </UserProfileProvider>
    );
}
