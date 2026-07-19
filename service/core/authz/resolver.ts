import { cache } from 'react';
import { getServerClient } from '@/lib/supabase/server';
import type { RequestContext } from '@/types/request-context';

/**
 * Effective-permission resolver.
 *
 * Returns the caller's granted actions as a map keyed by module — the union of
 * grants across all of the user's roles for the active company, in ONE query
 * (get_user_modules already BOOL_ORs across roles and returns `actions[]`).
 * Wrapped in React `cache()` so every authorization check in a request shares a
 * single RPC round-trip.
 *
 * This is the `RolePermissionProvider` in the design's provider pipeline. Future
 * providers (feature flags, subscription entitlements) can intersect their own
 * allow-sets with this map without changing any call site.
 */
export type GrantMap = Map<string, Set<string>>; // moduleKey -> Set<action>

const loadGrants = cache(
    async (userId: string, companyId: number): Promise<GrantMap> => {
        const supabase = getServerClient();
        const { data, error } = await supabase.rpc('get_user_modules', {
            p_user_id: userId,
            p_company_id: companyId,
        });
        const map: GrantMap = new Map();
        if (error || !data) return map;
        for (const row of data as Array<{ key: string; actions: string[] | null }>) {
            map.set(row.key, new Set(row.actions ?? []));
        }
        return map;
    },
);

export async function resolveGrants(ctx: RequestContext): Promise<GrantMap> {
    if (!ctx.userId || !ctx.companyId) return new Map();
    return loadGrants(ctx.userId, Number(ctx.companyId));
}
