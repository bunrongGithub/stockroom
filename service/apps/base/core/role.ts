import { BaseRepository, PaginationParams } from '@/service/core';
import type { QueryConfig } from '@/service/core/query/config.ts';
import type { QueryObject } from '@/service/core/query/types.ts';
import {
    ApiError,
    NotFoundError,
    ValidationError,
} from '@/service/core/api-response';
import {
    CreateRoleInput,
    createRoleSchema,
    ModuleActionGrantInput,
    SaveRoleInput,
    saveRoleSchema,
    UpdateRolePermissionsInput,
} from '@/service/schema/role.schema';
import { RequestContext } from '@/types/request-context';
import {
    extendedActionsForModule,
    impliedParentAction,
} from '@/service/core/authz/permissions';
import { isSuperUserOnlyModulePath } from '@/service/core/authz/super-user-modules';
import { z } from 'zod';

export class Role extends BaseRepository {
    constructor() {
        super();
    }

    /** Query Framework registry. */
    protected readonly queryConfig: QueryConfig = {
        table: 'roles',
        defaultSelect:
            'id, name, description, is_active, created_at, company(id, name)',
        searchable: ['name', 'description'],
        sortable: ['id', 'name', 'is_active', 'created_at'],
        filterable: {
            is_active: { type: 'boolean' },
            company_id: { type: 'foreign-key' },
            created_at: { type: 'date' },
        },
        defaultSort: [{ field: 'id', direction: 'desc' }],
        // Role dropdowns pull the whole list in one request.
        maxLimit: 1000,
    };

    /** Standardized list path (Query Framework). */
    async findAllV2(context: RequestContext, query: QueryObject) {
        return this.findAllQuery(context, query);
    }

    async findAll(
        context: RequestContext,
        params: PaginationParams,
        companyId?: number,
    ) {
        // `count: 'exact'` is required — without it Supabase returns count=null,
        // so meta.total/totalPages come back 0 and the list can never paginate.
        const baseQuery = this.db
            .from('roles')
            .select(
                'id, name, description, is_active, created_at, company(id, name)',
                { count: 'exact' },
            )
            .order('id', { ascending: false });

        const isSuperUser = await this.isSupperUser(context);

        if (isSuperUser) {
            // Super users may narrow to one company (e.g. role dropdowns
            // scoped to the company selected on the user form).
            const query = companyId
                ? this.applyCompanyFilter(baseQuery, companyId)
                : baseQuery;
            return this.paginate(query, params);
        }

        const query = this.applyCompanyFilter(
            baseQuery,
            Number(context.companyId),
        );
        return this.paginate(query, params);
    }
    async insertOne(context: RequestContext, payload: CreateRoleInput) {
        const { companyId } = context;
        const parsed = createRoleSchema.safeParse({
            ...payload,
            company_id: companyId,
        });

        if (!parsed.success)
            throw new ValidationError(
                'Validation failed',
                z.flattenError(parsed.error).fieldErrors as Record<
                    string,
                    string[]
                >,
            );

        const { data, error, status } = await this.db
            .from('roles')
            .insert(parsed.data)
            .select('*')
            .single();

        if (error) throw new ApiError(error.details, status, error.code);

        return data;
    }

    async findOne(context: RequestContext, id: number) {
        const baseQuery = this.db
            .from('roles')
            .select(
                '*, company(id, name), role_module_permission(id,can_view,can_create,can_update,can_delete,module:modules(id,key,label,path))',
            )
            .eq('id', id);

        const isSuperUser = await this.isSupperUser(context);
        const { data, error } = isSuperUser
            ? await baseQuery.maybeSingle()
            : await this.applyCompanyFilter(
                  baseQuery,
                  Number(context.companyId),
              ).maybeSingle();

        if (!data) {
            throw new NotFoundError(`Role with id ${id} not found`);
        }
        if (error) {
            throw new ApiError(error.message, 500, error.code);
        }

        // `grants` is the per-action truth the permission editor loads; the
        // role_module_permission array above stays for the legacy detail view.
        return { ...data, grants: await this.findGrants(id) };
    }

    async updateOne(
        context: RequestContext,
        id: number,
        payload: { name: string; description?: string | null },
    ) {
        const baseQuery = this.db
            .from('roles')
            .update(payload)
            .eq('id', id)
            .select('id, name, description')
            .single();

        const isSuperUser = await this.isSupperUser(context);

        if (isSuperUser) {
            const { data, error, status } = await baseQuery;
            return data;
        }

        const { data, error, status } = await this.applyCompanyFilter(
            this.db
                .from('roles')
                .update(payload)
                .eq('id', id)
                .select('id, name, description')
                .single(),
            Number(context.companyId),
        );
        if (error) {
            console.log(error);
            throw new ApiError(error.message, status, error.code);
        }
        return data;
    }

    async updatePermissions(
        context: RequestContext,
        roleId: number,
        permissions: UpdateRolePermissionsInput['permissions'],
    ) {
        // Object-level security: you may only manage permissions on a role that
        // belongs to your own company (unless super user). Returns 404 — never
        // 403 — so we don't reveal that the role exists in another company.
        const isSuperUser = await this.isSupperUser(context);
        const { data: role } = await this.db
            .from('roles')
            .select('id, company_id')
            .eq('id', roleId)
            .maybeSingle();
        if (
            !role ||
            (!isSuperUser && role.company_id !== Number(context.companyId))
        ) {
            throw new NotFoundError(`Role with id ${roleId} not found`);
        }
        const roleCompany = role.company_id as number;

        // Replace the CRUD flags.
        const { error: deleteError } = await this.db
            .from('role_module_permission')
            .delete()
            .eq('role_id', roleId);
        if (deleteError)
            throw new ApiError(deleteError.message, 500, deleteError.code);

        const granted = permissions.filter(
            (p) =>
                p.can_view ||
                p.can_create ||
                p.can_update ||
                p.can_delete ||
                p.can_export,
        );

        if (granted.length > 0) {
            const { error: insertError } = await this.db
                .from('role_module_permission')
                .insert(
                    granted.map((p) => ({
                        role_id: roleId,
                        company_id: roleCompany,
                        module_id: p.module_id,
                        can_view: p.can_view,
                        can_create: p.can_create,
                        can_update: p.can_update,
                        can_delete: p.can_delete,
                        can_export: p.can_export,
                    })),
                );
            if (insertError)
                throw new ApiError(insertError.message, 500, insertError.code);
        }

        // Re-sync the authorization grant table (the source of truth for
        // enforcement) for the edited modules: the CRUD actions straight from
        // the flags, PLUS each module's extended actions (post/void/approve/…)
        // derived from their base capability (post←update, void←delete). Without
        // this, a role edited through the CRUD editor can never gain post/void,
        // so those buttons stay hidden — the exact gap new companies hit.
        const moduleIds = permissions.map((p) => p.module_id);
        const keyById = new Map<number, string>();
        if (moduleIds.length > 0) {
            const { data: mods } = await this.db
                .from('modules')
                .select('id, key')
                .in('id', moduleIds);
            for (const m of mods ?? []) keyById.set(m.id, m.key as string);
            await this.db
                .from('role_module_action_permission')
                .delete()
                .eq('role_id', roleId)
                .in('module_id', moduleIds);
        }
        const mkRow = (module_id: number, action: string) => ({
            role_id: roleId,
            company_id: roleCompany,
            module_id,
            action,
            granted: true,
            created_by: context.userId,
            updated_by: context.userId,
        });
        const actionRows = granted.flatMap((p) => {
            const flags: Record<string, boolean> = {
                view: p.can_view,
                create: p.can_create,
                update: p.can_update,
                delete: p.can_delete,
                export: p.can_export,
            };
            const rows = (
                ['view', 'create', 'update', 'delete', 'export'] as const
            )
                .filter((a) => flags[a])
                .map((a) => mkRow(p.module_id, a));
            const key = keyById.get(p.module_id);
            if (key) {
                for (const { action, base } of extendedActionsForModule(key)) {
                    if (flags[base]) rows.push(mkRow(p.module_id, action));
                }
            }
            return rows;
        });
        if (actionRows.length > 0) {
            const { error } = await this.db
                .from('role_module_action_permission')
                .upsert(actionRows, {
                    onConflict: 'role_id,module_id,action',
                });
            if (error) throw new ApiError(error.message, 500, error.code);
        }

        return { success: true };
    }

    /**
     * Replace a role's entire grant set from the per-action editor.
     *
     * Writes both tables: `role_module_action_permission` (what
     * requirePermission and get_user_modules read) and the legacy
     * `role_module_permission` CRUD flags, kept in sync so the role detail
     * screen and any not-yet-migrated reader stay truthful.
     *
     * Not a single transaction — Supabase's REST client cannot span one. A
     * failure mid-way leaves the role with fewer grants than intended, which is
     * fail-closed and fixed by saving again.
     */
    /**
     * Module ids (parents *and* their action children) that only a super user
     * may grant. Resolved from `modules.path` so it survives environments where
     * the ids differ.
     */
    private async superUserOnlyModuleIds(): Promise<number[]> {
        const { data, error } = await this.db.from('modules').select('id, path');
        if (error) throw new ApiError(error.message, 500, error.code);
        return (data ?? [])
            .filter((m) => isSuperUserOnlyModulePath(m.path as string | null))
            .map((m) => m.id as number);
    }

    async syncActionGrants(
        context: RequestContext,
        roleId: number,
        roleCompanyId: number,
        permissions: ModuleActionGrantInput[],
    ) {
        /**
         * Super-user-only modules are invisible to everyone else's access tree,
         * so a normal admin's payload can never mention them. Two consequences,
         * both handled here:
         *
         *  - a payload that mentions one anyway was hand-crafted; drop it.
         *  - the wipe below must skip them, or simply renaming a role would
         *    revoke grants the editor was never shown and could not re-submit.
         *
         * A super user sees them in the tree, so their payload is authoritative
         * and nothing is withheld.
         */
        const offLimits = (await this.isSupperUser(context))
            ? []
            : await this.superUserOnlyModuleIds();

        const granted = permissions.filter(
            (p) => p.actions.length > 0 && !offLimits.includes(p.module_id),
        );

        // Wipe first: the editor always submits the complete desired state, so
        // anything absent has been revoked.
        const keepList = `(${offLimits.join(',')})`;

        let delActionsQuery = this.db
            .from('role_module_action_permission')
            .delete()
            .eq('role_id', roleId);
        if (offLimits.length)
            delActionsQuery = delActionsQuery.not('module_id', 'in', keepList);
        const { error: delActions } = await delActionsQuery;
        if (delActions)
            throw new ApiError(delActions.message, 500, delActions.code);

        let delFlagsQuery = this.db
            .from('role_module_permission')
            .delete()
            .eq('role_id', roleId);
        if (offLimits.length)
            delFlagsQuery = delFlagsQuery.not('module_id', 'in', keepList);
        const { error: delFlags } = await delFlagsQuery;
        if (delFlags) throw new ApiError(delFlags.message, 500, delFlags.code);

        if (granted.length === 0) return { success: true };

        const mkRow = (module_id: number, action: string) => ({
            role_id: roleId,
            company_id: roleCompanyId,
            module_id,
            action,
            granted: true,
            created_by: context.userId,
            updated_by: context.userId,
        });

        const rows = granted.flatMap((p) =>
            [...new Set(p.actions)].map((a) => mkRow(p.module_id, a)),
        );

        // Give each implied action page its own view grant (see
        // impliedParentAction) so the buttons this role can see actually open.
        const parentIds = granted.map((p) => p.module_id);
        const actionsByParent = new Map(
            granted.map((p) => [p.module_id, new Set(p.actions)]),
        );
        const { data: children } = await this.db
            .from('modules')
            .select('id, path, parent_id')
            .eq('type', 'action')
            .in('parent_id', parentIds);

        for (const child of children ?? []) {
            const parentActions = actionsByParent.get(child.parent_id as number);
            if (!parentActions) continue;
            const implied = impliedParentAction(String(child.path ?? ''));
            if (implied && parentActions.has(implied)) {
                rows.push(mkRow(child.id as number, 'view'));
            }
        }

        const { error: insertActions } = await this.db
            .from('role_module_action_permission')
            .upsert(rows, { onConflict: 'role_id,module_id,action' });
        if (insertActions)
            throw new ApiError(insertActions.message, 500, insertActions.code);

        // Mirror the CRUD subset into the legacy flag table.
        const flagRows = granted.map((p) => {
            const set = new Set(p.actions);
            return {
                role_id: roleId,
                company_id: roleCompanyId,
                module_id: p.module_id,
                can_view: set.has('view'),
                can_create: set.has('create'),
                can_update: set.has('update'),
                can_delete: set.has('delete'),
                can_export: set.has('export'),
            };
        });
        const { error: insertFlags } = await this.db
            .from('role_module_permission')
            .upsert(flagRows, { onConflict: 'role_id,module_id' });
        if (insertFlags)
            throw new ApiError(insertFlags.message, 500, insertFlags.code);

        return { success: true };
    }

    /** Create a role and its grants in one request from the permission editor. */
    async createWithGrants(context: RequestContext, payload: SaveRoleInput) {
        const parsed = saveRoleSchema.safeParse(payload);
        if (!parsed.success)
            throw new ValidationError(
                'Validation failed',
                z.flattenError(parsed.error).fieldErrors as Record<
                    string,
                    string[]
                >,
            );

        const companyId = Number(context.companyId);
        const { data, error, status } = await this.db
            .from('roles')
            .insert({
                name: parsed.data.name,
                description: parsed.data.description ?? null,
                is_active: parsed.data.is_active,
                company_id: companyId,
            })
            .select('id, name, description, is_active')
            .single();

        if (error) throw new ApiError(error.message, status, error.code);

        await this.syncActionGrants(
            context,
            data.id as number,
            companyId,
            parsed.data.permissions,
        );
        return data;
    }

    /** Update a role's header and replace its grants. */
    async updateWithGrants(
        context: RequestContext,
        id: number,
        payload: SaveRoleInput,
    ) {
        const parsed = saveRoleSchema.safeParse(payload);
        if (!parsed.success)
            throw new ValidationError(
                'Validation failed',
                z.flattenError(parsed.error).fieldErrors as Record<
                    string,
                    string[]
                >,
            );

        // Object-level security: 404 rather than 403 so a role in another
        // company is not confirmed to exist.
        const isSuperUser = await this.isSupperUser(context);
        const { data: role } = await this.db
            .from('roles')
            .select('id, company_id')
            .eq('id', id)
            .maybeSingle();
        if (
            !role ||
            (!isSuperUser && role.company_id !== Number(context.companyId))
        ) {
            throw new NotFoundError(`Role with id ${id} not found`);
        }

        const { data, error, status } = await this.db
            .from('roles')
            .update({
                name: parsed.data.name,
                description: parsed.data.description ?? null,
                is_active: parsed.data.is_active,
            })
            .eq('id', id)
            .select('id, name, description, is_active')
            .single();
        if (error) throw new ApiError(error.message, status, error.code);

        await this.syncActionGrants(
            context,
            id,
            role.company_id as number,
            parsed.data.permissions,
        );
        return data;
    }

    /** module_id → granted action verbs, the shape the editor loads. */
    async findGrants(roleId: number): Promise<Record<number, string[]>> {
        const { data, error } = await this.db
            .from('role_module_action_permission')
            .select('module_id, action')
            .eq('role_id', roleId)
            .eq('granted', true);
        if (error) throw new ApiError(error.message, 500, error.code);

        const out: Record<number, string[]> = {};
        for (const row of data ?? []) {
            const id = row.module_id as number;
            (out[id] ??= []).push(row.action as string);
        }
        return out;
    }

    async deleteOne(context: RequestContext, id: number) {
        const isSuperUser = await this.isSupperUser(context);
        const { error, status } = await this.applyFilter(
            this.db.from('roles').delete().eq('id', id),
            context,
            isSuperUser,
        );
        if (error) throw new ApiError(error.message, status, error.code);
        return { success: true };
    }
}
