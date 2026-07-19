import { BaseRepository, PaginationParams } from '@/service/core';
import {
    ApiError,
    NotFoundError,
    ValidationError,
} from '@/service/core/api-response';
import {
    CreateRoleInput,
    createRoleSchema,
    UpdateRolePermissionsInput,
} from '@/service/schema/role.schema';
import { RequestContext } from '@/types/request-context';
import { z } from 'zod';

export class Role extends BaseRepository {
    constructor() {
        super();
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
            .select('id, name, description, created_at, company(id, name)', {
                count: 'exact',
            })
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
        if (isSuperUser) {
            const { data, error } = await baseQuery.maybeSingle();
            if (!data) {
                throw new NotFoundError(`Role with id ${id} not found`);
            }
            if (error) {
                console.log(error);
                throw new ApiError(error.message, 500, error.code).toResponse();
            }
            return data;
        }
        const { data, error } = await this.applyCompanyFilter(
            baseQuery,
            Number(context.companyId),
        ).maybeSingle();

        if (!data) {
            throw new NotFoundError(`Role with id ${id} not found`);
        }
        if (error) {
            console.log(error);
            throw new ApiError(error.message, 500, error.code).toResponse();
        }
        return data;
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

        // Keep the authorization grant table (source of truth for enforcement)
        // in sync for the CRUD actions on the edited modules. Extended actions
        // (post/void/…) are managed separately and left intact.
        const moduleIds = permissions.map((p) => p.module_id);
        if (moduleIds.length > 0) {
            await this.db
                .from('role_module_action_permission')
                .delete()
                .eq('role_id', roleId)
                .in('module_id', moduleIds)
                .in('action', ['view', 'create', 'update', 'delete', 'export']);
        }
        const actionRows = granted.flatMap((p) =>
            (
                [
                    ['view', p.can_view],
                    ['create', p.can_create],
                    ['update', p.can_update],
                    ['delete', p.can_delete],
                    ['export', p.can_export],
                ] as const
            )
                .filter(([, on]) => on)
                .map(([action]) => ({
                    role_id: roleId,
                    company_id: roleCompany,
                    module_id: p.module_id,
                    action,
                    granted: true,
                    created_by: context.userId,
                    updated_by: context.userId,
                })),
        );
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
