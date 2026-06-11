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
import type { AppInitData, AppModule, AppPermission, AppProfile } from '@/types/app';
import { DEFAULT_PERMISSION } from '@/types/app';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface AppContextValue {
    profile: AppProfile | null;
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

const CACHE_KEY = 'erp_app_init';

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
    } catch { /* noop */ }
}

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

const AppContext = createContext<AppContextValue>({
    profile: null,
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

export function AppProvider({ children }: { children: ReactNode }) {
    // Attempt instant hydration from localStorage before first paint
    const [data, setData] = useState<AppInitData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
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

        const cached = readCache();
        if (cached) {
            setData(cached);
            setIsLoading(false);
        } else {
            fetchInit();
        }
    }, [fetchInit]);

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
