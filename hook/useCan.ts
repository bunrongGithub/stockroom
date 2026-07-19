'use client';

import { useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import type { Permission } from '@/service/core/authz/permissions';

/**
 * Frontend authorization check — mirrors the backend's `requirePermission`
 * using the SAME typed catalog, so UI gating and API enforcement can never
 * drift. UX ONLY: the backend is the source of truth; hiding a button is a
 * convenience, never a security control.
 *
 *   const canPost = useCan(PERMISSIONS.sales.invoice.post);
 *   {status === 'DRAFT' && canPost && <PostButton />}
 *
 * Import the permission from `@/service/core/authz/permissions` (the pure,
 * client-safe catalog) — NOT the `@/service/core/authz` barrel, which pulls in
 * server-only code.
 */
export function useCan(
    permission: Permission | Permission[],
    opts?: { all?: boolean },
): boolean {
    const { modules, profile } = useApp();

    const grants = useMemo(() => {
        const map = new Map<string, Set<string>>();
        for (const m of modules) {
            if (m.actions?.length) map.set(m.key, new Set(m.actions));
        }
        return map;
    }, [modules]);

    // Vendor super users bypass on the backend — match that in the UI.
    if (profile?.isSuperUser) return true;

    const perms = Array.isArray(permission) ? permission : [permission];
    if (!perms.length) return true;
    const held = (p: Permission): boolean =>
        grants.get(p.moduleKey)?.has(p.action) ?? false;
    return opts?.all ? perms.every(held) : perms.some(held);
}
