/**
 * Authorization Framework — the single entry point.
 *
 *   import { defineRoute, requirePermission, PERMISSIONS } from '@/service/core/authz';
 *
 * The backend's source of truth for authorization. Routes declare the permission
 * they need; the framework resolves the caller's effective grants (role →
 * role_module_action_permission, merged across roles, company-scoped), enforces
 * it, audits denials, and standardizes the response. Super users bypass, audited.
 */
export { PERMISSIONS, allPermissions } from './permissions';
export type { Permission, PermissionAction } from './permissions';
export { requirePermission, can } from './require-permission';
export { decideAccess, type AccessDecision } from './decide';
export { defineRoute } from './define-route';
export { AuthorizationError } from './errors';
export { resolveGrants, type GrantMap } from './resolver';
export { logAuthzEvent } from './audit';
