'use client';

import { useModuleContext } from '@/context/ModuleContext';
import { getStaticActions, getDynamicActions } from '@/hook/usePageAction';
import { usePageActions } from '@/hook/usePageAction';
import type { AppModule, AppPermission } from '@/types/app';
import { useEffect } from 'react';

interface UseModuleActionsOptions {
    actionModules?: AppModule[] | null;
    permission?: AppPermission;
    modulePath?: string | null;
}

/**
 * Called once from the layout's ModuleActionBridge.
 * Reads values from ModuleContext and writes computed actions into PageActionContext.
 */
export function useModuleActions({
    actionModules,
    permission,
    modulePath,
}: UseModuleActionsOptions) {
    const { setActions } = usePageActions();

    // Serialize to stable strings — new array/object references on every parent
    // render would otherwise re-trigger the effect and loop infinitely.
    const actionModulesKey = JSON.stringify(actionModules ?? null);
    const permissionKey = JSON.stringify(permission ?? null);

    useEffect(() => {
        const modules: AppModule[] = JSON.parse(actionModulesKey) ?? [];
        const perm: AppPermission | undefined =
            JSON.parse(permissionKey) ?? undefined;

        const _actions = modules.filter((m) => m.type === 'action');
        const staticActions = getStaticActions(_actions, perm);
        const dynamicActions = getDynamicActions(_actions, perm);

        setActions([...staticActions, ...dynamicActions]);
        return () => setActions([]);
    }, [actionModulesKey, permissionKey, modulePath, setActions]);
}

/**
 * Called in every module component.
 * Registers { actionModules, permission, modulePath } into ModuleContext so
 * the layout's ModuleActionBridge can call useModuleActions in one place.
 */
export function useRegisterModule({
    actionModules,
    permission,
    modulePath,
}: UseModuleActionsOptions) {
    const { register, clear } = useModuleContext();

    const actionModulesKey = JSON.stringify(actionModules ?? null);
    const permissionKey = JSON.stringify(permission ?? null);

    useEffect(() => {
        register({
            actionModules: JSON.parse(actionModulesKey) ?? null,
            permission: JSON.parse(permissionKey) ?? null,
            modulePath: modulePath ?? null,
        });
        return clear;
    }, [actionModulesKey, permissionKey, modulePath, register, clear]);
}
