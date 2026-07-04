import { BaseRepository, PaginationParams } from '@/service/core';
import { ApiError, ValidationError } from '@/service/core/api-response';
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
    async findAll(context: RequestContext, params: PaginationParams) {
        const baseQuery = this.db
            .from('roles')
            .select('id, name, description, created_at, company(id, name)')
            .order('id', { ascending: false });

        const isSuperUser = await this.isSupperUser(context);

        if (isSuperUser) {
            return this.paginate(baseQuery, params);
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
        const { data, error } = await this.applyCompanyFilter(
            this.db
                .from('roles')
                .select(
                    '*, company(id, name), role_module_permission(id,can_view,can_create,can_update,can_delete,module:modules(id,key,label,path))',
                )
                .eq('id', id),
            Number(context.companyId),
        ).single();
        if (error) {
            throw new ApiError(error.message, 500, error.code).toResponse();
        }
        return data;
    }

    async updateOne(
        context: RequestContext,
        id: number,
        payload: { name: string; description?: string | null },
    ) {
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
        _context: RequestContext,
        roleId: number,
        permissions: UpdateRolePermissionsInput['permissions'],
    ) {
        const { error: deleteError } = await this.db
            .from('role_module_permission')
            .delete()
            .eq('role_id', roleId);

        if (deleteError)
            throw new ApiError(deleteError.message, 500, deleteError.code);

        const toInsert = permissions
            .filter(
                (p) =>
                    p.can_view || p.can_create || p.can_update || p.can_delete,
            )
            .map((p) => ({
                role_id: roleId,
                module_id: p.module_id,
                can_view: p.can_view,
                can_create: p.can_create,
                can_update: p.can_update,
                can_delete: p.can_delete,
            }));

        if (toInsert.length > 0) {
            const { error: insertError } = await this.db
                .from('role_module_permission')
                .insert(toInsert);

            if (insertError)
                throw new ApiError(insertError.message, 500, insertError.code);
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
