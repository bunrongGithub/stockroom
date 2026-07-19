import type { NextRequest } from 'next/server';
import { fetchSuperUserFlag } from '@/service/core/base-repository';
import type { RequestContext } from '@/types/request-context';
import { logAuthzEvent } from './audit';
import { decideAccess } from './decide';
import { AuthorizationError } from './errors';
import type { Permission } from './permissions';
import { resolveGrants } from './resolver';

/**
 * The core authorization guard. Throws `AuthorizationError` (403) — and writes
 * a denial to authorization_event — unless the caller holds the permission.
 *
 * Super users (vendor operators) short-circuit both authorization and tenant
 * isolation; per the approved policy every super-user WRITE is audited
 * (`allowed_sensitive`) while reads stay quiet to avoid log noise.
 *
 * `all: true` requires every permission (AND); default requires any (OR).
 */
export async function requirePermission(
    ctx: RequestContext,
    permission: Permission | Permission[],
    opts?: { req?: NextRequest; all?: boolean },
): Promise<void> {
    const perms = Array.isArray(permission) ? permission : [permission];
    if (!perms.length) return;

    const isSuperUser = ctx.userId
        ? await fetchSuperUserFlag(ctx.userId)
        : false;
    if (isSuperUser) {
        // Vendor bypass — audit only the sensitive (non-view) accesses.
        const sensitive = perms.find((p) => p.action !== 'view');
        if (sensitive) {
            await logAuthzEvent(
                ctx,
                sensitive,
                'allowed_sensitive',
                'super_user',
                opts?.req,
            );
        }
        return;
    }

    const grants = await resolveGrants(ctx);
    const decision = decideAccess(grants, perms, { all: opts?.all });
    if (decision.allowed) return;

    const denied = decision.deniedPermission ?? perms[0];
    await logAuthzEvent(ctx, denied, 'denied', 'permission_denied', opts?.req);
    throw new AuthorizationError(`Permission denied: ${denied.key}`);
}

/** Imperative boolean check (no throw) — for conditional logic inside handlers. */
export async function can(
    ctx: RequestContext,
    permission: Permission,
): Promise<boolean> {
    if (ctx.userId && (await fetchSuperUserFlag(ctx.userId))) return true;
    const grants = await resolveGrants(ctx);
    return grants.get(permission.moduleKey)?.has(permission.action) ?? false;
}
