/**
 * Modules only a super user may reach — or grant.
 *
 * Module administration edits the application's own navigation, routing and
 * component wiring: a bad row there breaks pages for every company, not just
 * the editor's own. So it sits outside the normal per-role permission model. A
 * company admin cannot see it in the role editor's access tree, and therefore
 * cannot grant it to a role they control.
 *
 * Matched on `modules.path` rather than id, because ids differ per environment
 * while the path is the route itself.
 */
export const SUPER_USER_ONLY_MODULE_PATHS = ['/setting/module'] as const;

/**
 * True when the module — or one of its action children — is super-user-only.
 *
 * Action rows live under the parent's path (`/setting/module/create`), so a
 * prefix test covers the whole subtree with one rule.
 */
export function isSuperUserOnlyModulePath(path: string | null | undefined) {
    if (!path) return false;
    return SUPER_USER_ONLY_MODULE_PATHS.some(
        (p) => path === p || path.startsWith(`${p}/`),
    );
}