import { getServerClient } from '@/lib/supabase/server';
import type { AppModule } from '@/types/app';

type UserModuleRow = {
    id: number; key: string; label: string; path: string; component: string;
    parent_id: number | null; icon: string | null; sort_order: number;
    is_active: boolean; type: string | null; is_initial_data: boolean;
    can_view: boolean; can_create: boolean; can_update: boolean;
    can_delete: boolean; can_export: boolean;
};

export async function getUserModulesWithPermissions(
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

    return (data as UserModuleRow[] ?? []).map((row) => ({
        id: row.id,
        key: row.key,
        label: row.label,
        path: row.path,
        component: row.component,
        parent_id: row.parent_id,
        icon: row.icon,
        sort_order: row.sort_order,
        is_active: row.is_active,
        type: (row.type ?? 'transaction') as AppModule['type'],
        is_initial_data: row.is_initial_data ?? false,
        permission: {
            can_view: row.can_view,
            can_create: row.can_create,
            can_update: row.can_update,
            can_delete: row.can_delete,
            can_export: row.can_export,
        },
    }));
}

export interface ResolvedModule {
    module: AppModule;
    actionModules: AppModule[];
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

export async function resolveModuleByPath(
    path: string,
    userId: string,
    companyId: number,
): Promise<ResolvedModule | null> {
    const modules = await getUserModulesWithPermissions(userId, companyId);
    const _module =
        modules.find((m) => m.path === path) ??
        modules.find((m) => pathMatches(m.path, path));
    if (!_module) return null;
    const actionModules = modules.filter(
        (m) => m.type === 'action' && m.parent_id === _module.id,
    );
    return { module: _module, actionModules };
}
