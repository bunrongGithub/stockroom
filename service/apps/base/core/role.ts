import { BaseRepository, PaginationParams } from '@/service/core';
import { ApiError, ValidationError } from '@/service/core/api-response';
import {
    CreateRoleInput,
    createRoleSchema,
} from '@/service/schema/role.schema';
import { RequestContext } from '@/types/request-context';
import { z } from 'zod';

export class Role extends BaseRepository {
    constructor() {
        super();
    }
    async findAll(context: RequestContext, params: PaginationParams) {
        const query = this.applyFilter(
            this.db
                .from('roles')
                .select('id, name, description, created_at, company(id, name)')
                .order('id', { ascending: false }),
            context,
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
        const { data, error } = await this.applyFilter(
            this.db
                .from('roles')
                .select(
                    '*, company(id, name), role_module_permission(id,can_view,can_create,can_update,can_delete,module:modules(id,key,label,path))',
                )
                .eq('id', id),
            context,
        ).single();
        if (error) throw new ApiError(error.details, 1, error.code);
        return data;
    }
}
