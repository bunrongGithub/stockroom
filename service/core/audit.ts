import { cache } from 'react';
import { getServerClient } from '@/lib/supabase/server';
import type { AuditUser } from '@/types/audit';

/**
 * Shared Audit Metadata resolution.
 *
 * created_by / updated_by store a `profiles.id`. This module turns those ids
 * into displayable `{ id, full_name, avatar_url, email }` in ONE batched query
 * per request — never per row — so lists and detail pages show "who" without
 * N+1.
 *
 * Email comes from `user_profiles_view`, which is where `profiles` meets
 * `auth.users`; the same view the User module lists from, so an audit badge and
 * the user directory always agree on a person's name and address. Only the four
 * display columns are selected, so the view's `roles` aggregate is never
 * evaluated.
 */

export type { AuditUser, AuditMeta } from '@/types/audit';

// Per-request dedupe: keyed by the sorted id set, so the same list (or several
// repos in one handler) resolves a given batch of profiles exactly once.
const fetchProfiles = cache(
    async (idsKey: string): Promise<Record<string, AuditUser>> => {
        const ids = idsKey ? idsKey.split(',') : [];
        if (!ids.length) return {};
        const db = getServerClient();
        const map: Record<string, AuditUser> = {};

        const { data } = await db
            .from('user_profiles_view')
            .select('id, full_name, avatar_url, email')
            .in('id', ids);
        for (const row of data ?? []) {
            map[row.id] = {
                id: row.id,
                full_name: row.full_name ?? null,
                avatar_url: row.avatar_url ?? null,
                email: row.email ?? null,
            };
        }

        // The view inner-joins auth.users, so a profile whose auth account was
        // deleted would vanish and its records would read "System". Fall back to
        // the base table for those, emailless but still attributed.
        const missing = ids.filter((id) => !map[id]);
        if (missing.length) {
            const { data: orphans } = await db
                .from('profiles')
                .select('id, full_name, avatar_url')
                .in('id', missing);
            for (const row of orphans ?? []) {
                map[row.id] = {
                    id: row.id,
                    full_name: row.full_name ?? null,
                    avatar_url: row.avatar_url ?? null,
                    email: null,
                };
            }
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
