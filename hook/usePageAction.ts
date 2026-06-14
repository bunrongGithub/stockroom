'use client';

import {
    PageActionContext,
    PageActionContextValue,
} from '@/context/PageActionContext';
import type { Action } from '@/types';
import type { AppModule, AppPermission } from '@/types/app';
import * as LucideIcons from 'lucide-react';
import type { LucideIcon as TLucideIcon } from 'lucide-react';
import { useContext } from 'react';

function LucideIcon(name: string | null): TLucideIcon | null {
    if (!name) return null;
    return (
        (LucideIcons as unknown as Record<string, TLucideIcon>)[name] ?? null
    );
}

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
            icon: LucideIcon(item?.icon ?? null),
            key: item.key,
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
            key: item.key,
            icon: LucideIcon(item.icon),
        }));
};
