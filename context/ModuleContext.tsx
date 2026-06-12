'use client';

import type { AppModule, AppPermission } from '@/types/app';
import { createContext, useCallback, useContext, useState } from 'react';

interface ModuleActionsState {
    actionModules: AppModule[] | null;
    permission: AppPermission | null;
    modulePath: string | null;
}

interface ModuleContextValue extends ModuleActionsState {
    register: (state: ModuleActionsState) => void;
    clear: () => void;
}

const EMPTY: ModuleActionsState = {
    actionModules: null,
    permission: null,
    modulePath: null,
};

const ModuleContext = createContext<ModuleContextValue | null>(null);

export function useModuleContext() {
    const ctx = useContext(ModuleContext);
    if (!ctx)
        throw new Error('useModuleContext must be used inside <ModuleProvider>');
    return ctx;
}

export function ModuleProvider({ children }: { children: React.ReactNode }) {
    const [state, setState] = useState<ModuleActionsState>(EMPTY);

    const register = useCallback(
        (next: ModuleActionsState) => setState(next),
        [],
    );
    const clear = useCallback(() => setState(EMPTY), []);

    return (
        <ModuleContext.Provider value={{ ...state, register, clear }}>
            {children}
        </ModuleContext.Provider>
    );
}
