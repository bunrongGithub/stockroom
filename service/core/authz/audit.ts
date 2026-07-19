import { getServerClient } from '@/lib/supabase/server';
import type { RequestContext } from '@/types/request-context';
import type { Permission } from './permissions';

type Decision = 'denied' | 'allowed_sensitive';

/**
 * Append a row to authorization_event. Best-effort and non-blocking: an audit
 * write must never break a request, so failures are logged, not thrown.
 * Written via the service-role client (bypasses RLS by design).
 */
export async function logAuthzEvent(
    ctx: RequestContext,
    permission: Permission,
    decision: Decision,
    reason: string,
    req?: { method?: string; url?: string; headers?: Headers },
): Promise<void> {
    try {
        await getServerClient()
            .from('authorization_event')
            .insert({
                user_id: ctx.userId || null,
                company_id: ctx.companyId ? Number(ctx.companyId) : null,
                permission_key: permission.key,
                module: permission.moduleKey,
                action: permission.action,
                decision,
                reason,
                route: req?.url ? new URL(req.url).pathname : null,
                method: req?.method ?? null,
                ip:
                    req?.headers?.get('x-forwarded-for')?.split(',')[0]?.trim() ??
                    null,
            });
    } catch (e) {
        console.error('[authz] failed to write authorization_event', e);
    }
}
