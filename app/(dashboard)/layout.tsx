'use client';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { PageActionContext } from '@/context/PageActionContext';
import { AppProvider, useApp } from '@/context/AppContext';
import { UserProfileProvider } from '@/context/UserProfileContext';
import { clearAppCache } from '@/context/AppContext';
import type { AppModule } from '@/types/app';
import { supabase } from '@/lib/supabase/client';
import {
    Box, BadgePercent, Package, Warehouse, ArrowLeftRight,
    Settings, Tag, Ruler, Award, ChevronDown, ChevronRight,
    Loader2, LogOut,
    User,
    UserCheck,
    ShoppingBagIcon,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import type { Action } from '@/types';

// ─────────────────────────────────────────────────────────────────────────────
// Icon map: DB icon name → Lucide component
// ─────────────────────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, LucideIcon> = {
    Box, BadgePercent, Package, Warehouse, ArrowLeftRight,
    Settings, Tag, Ruler, Award,User, UserCheck, ShoppingBagIcon
};

function ModuleIcon({ name, size = 16, className }: { name: string | null; size?: number; className?: string }) {
    if (!name) return null;
    const Icon = ICON_MAP[name];
    if (!Icon) return null;
    return <Icon size={size} className={className} strokeWidth={2} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar inner — consumes AppContext
// ─────────────────────────────────────────────────────────────────────────────

function SidebarNav() {
    const pathname = usePathname();
    const { visibleRootModules, visibleChildren, isLoading } = useApp();
    const [openMap, setOpenMap] = useState<Record<string, boolean>>({});

    const isActive = (path: string) =>
        pathname === path || (pathname.startsWith(path + '/') && path !== '/');

    const toggle = (key: string) =>
        setOpenMap((p) => ({ ...p, [key]: !p[key] }));

    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center py-8">
                <Loader2 size={18} className="animate-spin text-gray-600" />
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1 scrollbar-hide">
            <p className="px-2 text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-2">
                Modules
            </p>

            {visibleRootModules.map((mod) => {
                const children = visibleChildren(mod.id);
                const modActive =
                    isActive(mod.path) ||
                    children.some((c) => isActive(c.path)) ||
                    children.some((c) => visibleChildren(c.id).some((s) => isActive(s.path)));
                const isOpen = openMap[mod.key] ?? modActive;

                return (
                    <div key={mod.key}>
                        <button
                            type="button"
                            onClick={() => toggle(mod.key)}
                            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                                ${modActive
                                    ? 'bg-emerald-500/10 text-emerald-300'
                                    : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'
                                }`}
                        >
                            <ModuleIcon
                                name={mod.icon}
                                size={16}
                                className={modActive ? 'text-emerald-400' : 'text-gray-500'}
                            />
                            <span className="flex-1 text-left">{mod.label}</span>
                            {children.length > 0 && (
                                <ChevronDown
                                    size={14}
                                    className={`transition-transform ${isOpen ? 'rotate-180' : ''} ${modActive ? 'text-emerald-400' : 'text-gray-600'}`}
                                />
                            )}
                        </button>

                        {isOpen && children.length > 0 && (
                            <div className="ml-4 mt-0.5 space-y-0.5 border-l border-gray-800 pl-3">
                                {children.map((child) => (
                                    <SidebarMenuRow
                                        key={child.key}
                                        item={child}
                                        depth={1}
                                        visibleChildren={visibleChildren}
                                        openMap={openMap}
                                        toggle={toggle}
                                        isActive={isActive}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

function SidebarMenuRow({
    item,
    depth,
    visibleChildren,
    openMap,
    toggle,
    isActive,
}: {
    item: AppModule;
    depth: number;
    visibleChildren: (id: number) => AppModule[];
    openMap: Record<string, boolean>;
    toggle: (key: string) => void;
    isActive: (path: string) => boolean;
}) {
    const children = visibleChildren(item.id);
    const active = isActive(item.path) || children.some((c) => isActive(c.path));
    const isOpen = openMap[item.key] ?? active;

    return (
        <div>
            <div className="flex items-center">
                <Link
                    href={item.path}
                    className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all
                        ${active
                            ? 'bg-emerald-500/10 text-emerald-300 font-medium'
                            : 'text-gray-500 hover:bg-gray-800/40 hover:text-gray-200'
                        }`}
                >
                    {depth === 1 && (
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${active ? 'bg-emerald-400' : 'bg-gray-700'}`} />
                    )}
                    {item.label}
                </Link>
                {children.length > 0 && (
                    <button
                        type="button"
                        onClick={() => toggle(item.key)}
                        className="p-1 text-gray-600 hover:text-gray-400"
                    >
                        <ChevronRight
                            size={12}
                            className={`transition-transform ${isOpen ? 'rotate-90' : ''}`}
                        />
                    </button>
                )}
            </div>

            {isOpen && children.length > 0 && (
                <div className="ml-3 mt-0.5 space-y-0.5 border-l border-gray-800/60 pl-3">
                    {children.map((sub) => (
                        <SidebarMenuRow
                            key={sub.key}
                            item={sub}
                            depth={depth + 1}
                            visibleChildren={visibleChildren}
                            openMap={openMap}
                            toggle={toggle}
                            isActive={isActive}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Top navbar — configuration-type children of the active transaction module
// ─────────────────────────────────────────────────────────────────────────────

function TopNavConfigTabs() {
    const pathname = usePathname();
    const { modules, configChildren } = useApp();

    const isActive = (path: string) =>
        pathname === path || (pathname.startsWith(path + '/') && path !== '/');

    // Find the transaction root module that is currently active
    const activeRoot = modules.find(
        (m) =>
            m.parent_id === null &&
            m.type !== 'action' &&
            m.permission.can_view &&
            (isActive(m.path) ||
                modules.some((c) => c.parent_id === m.id && isActive(c.path)) ||
                modules.some(
                    (c) =>
                        c.parent_id === m.id &&
                        modules.some((s) => s.parent_id === c.id && isActive(s.path)),
                )),
    );

    if (!activeRoot) return null;

    // Walk down to find the deepest active transaction ancestor with config children
    const allTransaction = modules.filter((m) => m.type === 'transaction');
    const activeParent =
        allTransaction.find((m) => {
            const kids = configChildren(m.id);
            return kids.length > 0 && (isActive(m.path) || kids.some((k) => isActive(k.path)));
        }) ?? null;

    if (!activeParent) return null;

    const tabs = configChildren(activeParent.id);

    return (
        <>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-widest pr-3 border-r border-gray-800 mr-2 shrink-0">
                {activeParent.label}
            </span>
            {tabs.map((item) => {
                const active = isActive(item.path);
                return (
                    <Link
                        key={item.key}
                        href={item.path}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0
                            ${active
                                ? 'bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/30'
                                : 'text-gray-500 hover:bg-gray-800/60 hover:text-gray-200'
                            }`}
                    >
                        <ModuleIcon
                            name={item.icon}
                            size={13}
                            className={active ? 'text-emerald-400' : 'text-gray-600'}
                        />
                        {item.label}
                    </Link>
                );
            })}
        </>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Profile strip at the bottom of sidebar
// ─────────────────────────────────────────────────────────────────────────────

function SidebarProfile() {
    const { profile } = useApp();
    const router = useRouter();
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    const email = profile?.email ?? '...';
    const role = profile?.role ?? '';
    const initials = email && !['...'].includes(email)
        ? email.substring(0, 2).toUpperCase()
        : 'AD';

    const handleLogout = async () => {
        setIsLoggingOut(true);
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
            clearAppCache();
            router.push('/signin');
        } catch {
            setIsLoggingOut(false);
        }
    };

    return (
        <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-gray-800/50 transition group">
            <div className="bg-linear-to-br from-emerald-600 to-emerald-400 text-white w-8 h-8 shrink-0 rounded-full flex items-center justify-center font-bold text-xs shadow">
                {initials}
            </div>
            <div className="flex-1 overflow-hidden">
                <p className="text-gray-200 text-xs font-semibold truncate group-hover:text-white">
                    {email}
                </p>
                <p className="text-[10px] text-gray-500 capitalize">{role}</p>
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
                    <Loader2 size={15} className="animate-spin" />
                ) : (
                    <LogOut size={15} />
                )}
            </Button>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shell — full layout
// ─────────────────────────────────────────────────────────────────────────────

function DashboardShell({ children }: { children: React.ReactNode }) {
    const [appConfig, setAppConfig] = useState({ name: 'iCase', logo: '/icase.jpg' });
    const [actionList, setActionList] = useState<Action>([]);

    useEffect(() => {
        const load = async () => {
            const { data } = await supabase
                .from('settings')
                .select('shop_name, logo')
                .limit(1)
                .single();
            const row = data as unknown as { shop_name: string; logo: string } | null;
            if (row)
                setAppConfig({
                    name: row.shop_name || 'iCase Service',
                    logo: row.logo || '/icase.jpg',
                });
        };
        load();
        window.addEventListener('settingsUpdated', load);
        return () => window.removeEventListener('settingsUpdated', load);
    }, []);

    return (
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

                {/* DB-driven navigation */}
                <SidebarNav />

                <Separator className="bg-gray-800/60" />

                {/* Profile & Logout */}
                <div className="p-3 shrink-0">
                    <SidebarProfile />
                </div>
            </aside>

            {/* ═══════════════════ MAIN AREA ═══════════════════ */}
            <div className="flex flex-1 min-w-0 flex-col overflow-hidden">
                {/* Top Navbar — configuration tabs (only visible when active module has config children) */}
                <nav className="shrink-0 bg-gray-950 border-b border-gray-800/60">
                    <div className="flex h-12 items-center gap-1 px-6 overflow-x-auto scrollbar-hide">
                        <TopNavConfigTabs />
                    </div>
                </nav>

                {/* Page Content */}
                <main className="flex-1 min-h-0 overflow-y-auto bg-gray-50">
                    <PageActionContext.Provider
                        value={{ actions: actionList, setActions: setActionList }}
                    >
                        {children}
                    </PageActionContext.Provider>
                </main>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Root export — wraps everything in AppProvider + UserProfileProvider
// ─────────────────────────────────────────────────────────────────────────────

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <UserProfileProvider>
            <AppProvider>
                <DashboardShell>{children}</DashboardShell>
            </AppProvider>
        </UserProfileProvider>
    );
}
