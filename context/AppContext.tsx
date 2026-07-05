'use client';

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
    type ReactNode,
} from 'react';
import type {
    AppCompanyBrief,
    AppInitData,
    AppModule,
    AppPermission,
    AppProfile,
} from '@/types/app';
import { DEFAULT_PERMISSION } from '@/types/app';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface AppContextValue {
    profile: AppProfile | null;
    company: AppCompanyBrief | null;
    modules: AppModule[];
    isLoading: boolean;
    /** Returns merged permission for the given URL path, or deny-all if not found */
    getPermission: (path: string) => AppPermission;
    /** Top-level transaction modules (parent_id = null, can_view, not action) */
    visibleRootModules: AppModule[];
    /** transaction-type children for a parent — shown in the sidebar */
    visibleChildren: (parentId: number) => AppModule[];
    /** configuration-type children for a parent — shown in the top navbar */
    configChildren: (parentId: number) => AppModule[];
    /** Force re-fetch from server (e.g. after role change) */
    refetch: () => Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

// v2: payload gained `company` — bumping the key discards stale caches.
const CACHE_KEY = 'erp_app_init_v2';

function readCache(): AppInitData | null {
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (!raw) return null;
        return JSON.parse(raw) as AppInitData;
    } catch {
        return null;
    }
}

function writeCache(data: AppInitData) {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch {
        // localStorage might be unavailable (private mode, quota exceeded)
    }
}

export function clearAppCache() {
    try {
        localStorage.removeItem(CACHE_KEY);
        localStorage.removeItem('current_login_user_info');
    } catch { /* noop */ }
}

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

const AppContext = createContext<AppContextValue>({
    profile: null,
    company: null,
    modules: [],
    isLoading: true,
    getPermission: () => DEFAULT_PERMISSION,
    visibleRootModules: [],
    visibleChildren: () => [],
    configChildren: () => [],
    refetch: async () => {},
});

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

export function AppProvider({
    children,
    initialData,
}: {
    children: ReactNode;
    /** Menu/profile rendered on the server — avoids a client `/api/app/init` round-trip. */
    initialData?: AppInitData | null;
}) {
    // Seed from server-rendered data when available, else attempt instant
    // hydration from localStorage before first paint.
    const [data, setData] = useState<AppInitData | null>(initialData ?? null);
    const [isLoading, setIsLoading] = useState(!initialData);
    const fetchedRef = useRef(false);

    const fetchInit = useCallback(async () => {
        try {
            const res = await fetch('/api/app/init');
            if (res.ok) {
                const json: AppInitData = await res.json();
                setData(json);
                writeCache(json);
            }
        } catch (err) {
            console.error('[AppContext] init fetch failed:', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (fetchedRef.current) return;
        fetchedRef.current = true;

        // Server already provided the payload — cache it and skip the fetch.
        if (initialData) {
            writeCache(initialData);
            return;
        }

        const cached = readCache();
        if (cached) {
            setData(cached);
            setIsLoading(false);
        } else {
            fetchInit();
        }
    }, [fetchInit, initialData]);

    const refetch = useCallback(async () => {
        clearAppCache();
        setIsLoading(true);
        await fetchInit();
    }, [fetchInit]);

    // ── Derived values ────────────────────────────────────────────────────────

    const modules = data?.modules ?? [];

    const getPermission = useCallback(
        (path: string): AppPermission => {
            const mod = modules.find((m) => m.path === path);
            return mod?.permission ?? DEFAULT_PERMISSION;
        },
        [modules],
    );

    const visibleRootModules = modules.filter(
        (m) => m.parent_id === null && m.permission.can_view && m.type !== 'action',
    );

    // sidebar: transaction modules only (excludes action + configuration)
    const visibleChildren = useCallback(
        (parentId: number): AppModule[] =>
            modules.filter(
                (m) => m.parent_id === parentId && m.permission.can_view && m.type === 'transaction',
            ),
        [modules],
    );

    // top navbar: configuration modules only
    const configChildren = useCallback(
        (parentId: number): AppModule[] =>
            modules.filter(
                (m) => m.parent_id === parentId && m.permission.can_view && m.type === 'configuration',
            ),
        [modules],
    );

    return (
        <AppContext.Provider
            value={{
                profile: data?.profile ?? null,
                company: data?.company ?? null,
                modules,
                isLoading,
                getPermission,
                visibleRootModules,
                visibleChildren,
                configChildren,
                refetch,
            }}
        >
            {children}
        </AppContext.Provider>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useApp() {
    return useContext(AppContext);
}

/** Convenience hook: returns permission for the current path or deny-all */
export function useModulePermission(path: string): AppPermission {
    const { getPermission } = useApp();
    return getPermission(path);
}
