import { getServerClient } from '@/lib/supabase/server';
import type { AppModule } from '@/types/app';

/**
 * Returns all active modules with the user's merged permissions (OR across all roles).
 * Modules with no permission row default to all-false (deny by default).
 */
export async function getUserModulesWithPermissions(
    userId: string,
    companyId: number,
): Promise<AppModule[]> {
    const supabase = getServerClient();

    // Step 1: get the role IDs assigned to this user in this company
    const { data: userRoles, error: roleError } = await supabase
        .from('user_role')
        .select('role_id')
        .eq('user_id', userId)
        .eq('company_id', companyId);

    if (roleError) {
        console.error('[getUserModulesWithPermissions] role lookup failed:', roleError);
        return [];
    }

    const roleIds = (userRoles ?? []).map((r) => r.role_id as number);

    // Step 2: fetch all active modules
    const { data: modules, error: modError } = await supabase
        .from('modules')
        .select('id, key, label, path, component, parent_id, icon, sort_order, is_active, type')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

    if (modError) {
        console.error('[getUserModulesWithPermissions] modules fetch failed:', modError);
        return [];
    }

    if (!modules || modules.length === 0) return [];

    type RawModule = {
        id: number; key: string; label: string; path: string; component: string;
        parent_id: number | null; icon: string | null; sort_order: number;
        is_active: boolean; type?: string;
    };
    const rows = modules as unknown as RawModule[];

    // Step 3: if the user has no roles, return all modules with deny-all permissions
    if (roleIds.length === 0) {
        return rows.map((m) => ({
            id: m.id,
            key: m.key,
            label: m.label,
            path: m.path,
            component: m.component,
            parent_id: m.parent_id,
            icon: m.icon,
            sort_order: m.sort_order,
            is_active: m.is_active,
            type: (m.type ?? 'transaction') as AppModule['type'],
            permission: {
                can_view: false,
                can_create: false,
                can_update: false,
                can_delete: false,
                can_export: false,
            },
        }));
    }

    // Step 4: fetch permissions for those roles, merge with bool_or via JS
    const { data: perms, error: permError } = await supabase
        .from('role_module_permission')
        .select('module_id, can_view, can_create, can_update, can_delete, can_export')
        .in('role_id', roleIds);

    if (permError) {
        console.error('[getUserModulesWithPermissions] permission fetch failed:', permError);
    }

    // Merge permissions per module_id using OR logic
    const permMap = new Map<
        number,
        {
            can_view: boolean;
            can_create: boolean;
            can_update: boolean;
            can_delete: boolean;
            can_export: boolean;
        }
    >();

    for (const p of perms ?? []) {
        const moduleId = p.module_id as number;
        const existing = permMap.get(moduleId);
        if (existing) {
            existing.can_view = existing.can_view || p.can_view;
            existing.can_create = existing.can_create || p.can_create;
            existing.can_update = existing.can_update || p.can_update;
            existing.can_delete = existing.can_delete || p.can_delete;
            existing.can_export = existing.can_export || p.can_export;
        } else {
            permMap.set(moduleId, {
                can_view: p.can_view,
                can_create: p.can_create,
                can_update: p.can_update,
                can_delete: p.can_delete,
                can_export: p.can_export,
            });
        }
    }

    return rows.map((m) => ({
        id: m.id,
        key: m.key,
        label: m.label,
        path: m.path,
        component: m.component,
        parent_id: m.parent_id,
        icon: m.icon,
        sort_order: m.sort_order,
        is_active: m.is_active,
        type: (m.type ?? 'transaction') as AppModule['type'],
        permission: permMap.get(m.id) ?? {
            can_view: false,
            can_create: false,
            can_update: false,
            can_delete: false,
            can_export: false,
        },
    }));
}

/**
 * Resolves a single module by path and returns it with merged permissions.
 * Returns null if module not found or user lacks can_view.
 */
export async function resolveModuleByPath(
    path: string,
    userId: string,
    companyId: number,
): Promise<AppModule | null> {
    const modules = await getUserModulesWithPermissions(userId, companyId);
    return modules.find((m) => m.path === path) ?? null;
}
