import { cache } from 'react';
import { getServerClient } from '@/lib/supabase/server';
import type { AppModule } from '@/types/app';

// Wrapped in React `cache()` so the layout and the catch-all page share a single
// `get_user_modules` RPC per request instead of hitting Supabase twice.
export const getMenu = cache(async function getMenu(
    userId: string,
    companyId: number,
): Promise<AppModule[]> {
    const supabase = getServerClient();

    const { data, error } = await supabase.rpc('get_user_modules', {
        p_user_id: userId,
        p_company_id: companyId,
    });

    if (error) {
        console.error('[getUserModulesWithPermissions] rpc failed:', error);
        return [];
    }

    function toUserModule(data) {
        if (data && data.length > 0) {
            return data.map((item) => ({
                id: item.id,
                key: item.key,
                label: item.label,
                path: item.path,
                component: item.component,
                parent_id: item.parent_id,
                icon: item.icon,
                sort_order: item.sort_order,
                is_active: item.is_active,
                type: (item.type ?? 'transaction') as AppModule['type'],
                is_initial_data: item.is_initial_data ?? false,
                permission: {
                    can_view: item.can_view,
                    can_create: item.can_create,
                    can_update: item.can_update,
                    can_delete: item.can_delete,
                    can_export: item.can_export,
                },
            }));
        }
    }

    return toUserModule(data) ?? [];
});

export interface MenuPath {
    path: AppModule;
    pathActions: AppModule[];
}

function isDynamic(seg: string): boolean {
    return seg.startsWith(':') || (seg.startsWith('[') && seg.endsWith(']'));
}

function pathMatches(pattern: string, actual: string): boolean {
    const a = pattern.split('/');
    const b = actual.split('/');
    if (a.length !== b.length) return false;
    return a.every((seg, i) => isDynamic(seg) || seg === b[i]);
}

export async function getCurrentPath(
    path: string,
    userId: string,
    companyId: number,
): Promise<MenuPath | null> {
    const menus = await getMenu(userId, companyId);
    const currentPath =
        menus.find((m) => m.path === path) ??
        menus.find((m) => pathMatches(m.path, path));
    if (!currentPath) return null;
    const actionModules = menus.filter(
        (m) => m.type === 'action' && m.parent_id === currentPath.id,
    );
    return { path: currentPath, pathActions: actionModules };
}
