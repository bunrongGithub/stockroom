'use client';

import {
    PageActionContext,
    PageActionContextValue,
} from '@/context/PageActionContext';
import { resolveIcon } from '@/lib/resolve-icon';
import type { Action } from '@/types';
import type { AppModule, AppPermission } from '@/types/app';
import { Pencil, Trash2 } from 'lucide-react';
import { useContext, useEffect } from 'react';

export function usePageActions(): PageActionContextValue {
    const ctx = useContext(PageActionContext);
    if (!ctx) {
        throw new Error(
            'usePageActions must be used inside <PageActionContextProvider>',
        );
    }
    return ctx;
}

interface UseModuleActionsOptions {
    /** type=action child modules from DB — rendered as static header buttons */
    actionModules?: AppModule[] | null;
    /** when provided, appends Edit/Delete as dynamic (row-level) actions */
    permission?: AppPermission;
    modulePath?: string;
}

const getActionLabel = (
    action: boolean,
    actionLabel: 'view' | 'update' | 'edit' | 'delete' | 'export',
    actonModulePaths: AppModule[],
) => {
    if (action && actionLabel === 'view') {
        const path = actonModulePaths.find(
            (item) => item.is_active && item.path.endsWith('/view'),
        );
        if (path && path.label) {
            return path.label;
        } else {
            return 'Somthing Else';
        }
    } else if ((action && actionLabel === 'update') || actionLabel === 'edit') {
        const path = actonModulePaths.find(
            (item) =>
                (item.is_active && item.path.endsWith('/update')) ||
                item.path.endsWith('/edit'),
        );
        if (path && path.label) {
            return path.label;
        } else {
            return 'Somthing Else';
        }
    } else if (action && actionLabel === 'delete') {
        const path = actonModulePaths.find(
            (item) =>
                (item.is_active && item.path.endsWith('/delete')) ||
                item.path.endsWith('/edit'),
        );
        if (path && path.label) {
            return path.label;
        } else {
            return 'Somthing Else';
        }
    }
};
export function useModuleActions({
    actionModules,
    permission,
    modulePath,
}: UseModuleActionsOptions) {
    const { setActions } = usePageActions();
    useEffect(() => {
        const staticActions: Action = (actionModules ?? [])
            .filter(
                (m) =>
                    m.permission.can_view &&
                    !m.path.includes(':') &&
                    !m.path.includes('['),
            )
            .map((m) => ({
                label: m.label,
                href: m.path,
                type: 'user_action' as const,
                dynamic: false,
                icon: resolveIcon(m.icon),
            }));

        const dynamicActions: Action = [];
        if (permission?.can_update && modulePath) {
            dynamicActions.push({
                label: getActionLabel(
                    permission.can_update,
                    'update',
                    actionModules!,
                ) as string,
                href: `${modulePath}/:id/update`,
                type: 'user_action',
                dynamic: true,
                icon: Pencil,
            });
        }
        if (permission?.can_delete) {
            dynamicActions.push({
                label: getActionLabel(
                    permission.can_delete,
                    'delete',
                    actionModules!,
                ) as string,
                href: null,
                type: 'user_action',
                dynamic: true,
                icon: Trash2,
            });
        }
        if (permission?.can_view && modulePath) {
            dynamicActions.push({
                label: getActionLabel(
                    permission.can_view,
                    'view',
                    actionModules!,
                ) as string,
                href: `${modulePath}/:id/view`,
                type: 'user_action',
                dynamic: true,
                icon: Pencil,
            });
        }

        setActions([...staticActions, ...dynamicActions]);
        return () => setActions([]);
    }, [actionModules, permission, modulePath, setActions]);
}
