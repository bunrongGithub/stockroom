import { cache } from 'react';
import { getServerClient } from '@/lib/supabase/server';
import type { AuditUser } from '@/types/audit';

/**
 * Shared Audit Metadata resolution.
 *
 * created_by / updated_by store a `profiles.id`. This module turns those ids
 * into displayable `{ id, full_name, avatar_url }` in ONE batched query per
 * request — never per row — so lists and detail pages show "who" without N+1.
 */

export type { AuditUser, AuditMeta } from '@/types/audit';

// Per-request dedupe: keyed by the sorted id set, so the same list (or several
// repos in one handler) resolves a given batch of profiles exactly once.
const fetchProfiles = cache(
    async (idsKey: string): Promise<Record<string, AuditUser>> => {
        const ids = idsKey ? idsKey.split(',') : [];
        if (!ids.length) return {};
        const { data } = await getServerClient()
            .from('profiles')
            .select('id, full_name, avatar_url')
            .in('id', ids);
        const map: Record<string, AuditUser> = {};
        for (const row of data ?? []) {
            map[row.id] = {
                id: row.id,
                full_name: row.full_name ?? null,
                avatar_url: row.avatar_url ?? null,
            };
        }
        return map;
    },
);

/** Resolve a set of profile ids to their display info (one batched query). */
export async function resolveAuditUsers(
    ids: (string | null | undefined)[],
): Promise<Record<string, AuditUser>> {
    const unique = [...new Set(ids.filter((v): v is string => !!v))].sort();
    if (!unique.length) return {};
    return fetchProfiles(unique.join(','));
}
