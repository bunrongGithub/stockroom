import type { GrantMap } from './resolver';
import type { Permission } from './permissions';

export interface AccessDecision {
    allowed: boolean;
    /** The specific permission that failed (for the audit/deny message). */
    deniedPermission?: Permission;
}

/**
 * The PURE authorization decision — no DB, no I/O, no side effects. Given a
 * caller's effective grant map and the required permission(s), decide allow or
 * deny. Extracted from `requirePermission` so the matrix (role × module × action
 * → allow/deny), super-user bypass, and AND/ANY semantics can be exhaustively
 * unit-tested without touching Postgres.
 *
 *   - no permissions required          → allow
 *   - super user                       → allow (vendor bypass)
 *   - opts.all  → every permission held
 *   - default   → any permission held
 */
export function decideAccess(
    grants: GrantMap,
    permission: Permission | Permission[],
    opts: { all?: boolean; isSuperUser?: boolean } = {},
): AccessDecision {
    const perms = Array.isArray(permission) ? permission : [permission];
    if (!perms.length) return { allowed: true };
    if (opts.isSuperUser) return { allowed: true };

    const held = (p: Permission): boolean =>
        grants.get(p.moduleKey)?.has(p.action) ?? false;

    const allowed = opts.all ? perms.every(held) : perms.some(held);
    if (allowed) return { allowed: true };
    return { allowed: false, deniedPermission: perms.find((p) => !held(p)) ?? perms[0] };
}
