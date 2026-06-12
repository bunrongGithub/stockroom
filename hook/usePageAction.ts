'use client';

import {
    PageActionContext,
    PageActionContextValue,
} from '@/context/PageActionContext';
import { useModuleContext } from '@/context/ModuleContext';
import { resolveIcon } from '@/lib/resolve-icon';
import type { Action } from '@/types';
import type { AppModule, AppPermission } from '@/types/app';
import { useCallback, useContext, useEffect } from 'react';

export function usePageActions(): PageActionContextValue {
    const ctx = useContext(PageActionContext);
    if (!ctx) {
        throw new Error(
            'usePageActions must be used inside <PageActionContextProvider>',
        );
    }
    return ctx;
}


export const getStaticActions = (
    actions: AppModule[] | undefined,
    permisson: AppPermission | undefined,
): Action => {
    if (!actions) return [];
    return actions
        .filter(
            (a) =>
                a.path && a.path.endsWith('/create') && permisson?.can_create,
        )
        .map((item) => ({
            label: item.label,
            href: item.path,
            type: 'user_action' as const,
            dynamic: false,
            icon: resolveIcon(item.icon),
        }));
};

export const getDynamicActions = (
    actions: AppModule[] | undefined,
    permission: AppPermission | undefined,
): Action => {
    if (!actions) return [];
    return actions
        .filter((a) => {
            if (!a.path) return false;

            const p = a.path;
            const canUpdate = p.endsWith('/update') && permission?.can_update;
            const canView = p.endsWith('/view') && permission?.can_view;
            const canDelete = p.endsWith('/delete') && permission?.can_delete;

            return !!(canView || canUpdate || canDelete);
        })
        .map((item) => ({
            label: item.label,
            // Replace Next.js [id] segment with :id so resolveHref() can substitute
            // the actual row id when rendering per-row action buttons.
            href: item.path.replace('[id]', ':id'),
            type: 'user_action' as const,
            dynamic: true,
            icon: resolveIcon(item.icon),
        }));
};
