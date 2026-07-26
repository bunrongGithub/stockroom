import { PERMISSIONS, requirePermission } from '@/service/core/authz';
import { getRequestContext } from '@/lib/request-context';
import { getServerClient } from '@/lib/supabase/server';
import {
    ApiError,
    NotFoundError,
    ValidationError,
} from '@/service/core/api-response';
import AppPermissionService from '@/service/apps/base/core/permission';
import { NextRequest, NextResponse } from 'next/server';

const Service = AppPermissionService.getInstance();
export async function GET(request: NextRequest) {
    const requestContext = getRequestContext(request);
    await requirePermission(requestContext, PERMISSIONS.setting.role.view, { req: request });
    const searchParams = request.nextUrl.searchParams;

    const page = Number(searchParams.get('page') || 1);
    const limit = Number(searchParams.get('limit') || 10);
    const search = searchParams.get('search') ?? undefined;

    try {
        const data = await Service.findAll(requestContext, {
            page: page,
            limit: limit,
            searchColumn: 'permission',
            search: search,
        });
        return NextResponse.json(data);
    } catch (err) {
        return NextResponse.json({ error: String(err) }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const ctx = getRequestContext(req);
        await requirePermission(ctx, PERMISSIONS.setting.role.update, { req });
        const body = await req.json();
        const {
            role_id,
            module_id,
            module_type,
            can_view,
            can_create,
            can_update,
            can_delete,
            can_export,
        } = body;

        if (!role_id || !module_id) {
            return new ValidationError('Validation Errors', {
                role_id: ['role_id and module_id are required'],
            }).toResponse();
        }

        const supabase = getServerClient();

        // Object-level security: the role must belong to the caller's company.
        const { data: role } = await supabase
            .from('roles')
            .select('id, company_id')
            .eq('id', Number(role_id))
            .maybeSingle();
        if (!role || role.company_id !== Number(ctx.companyId)) {
            throw new NotFoundError('Role not found');
        }
        const companyId = role.company_id as number;
        const flags = {
            can_view: !!can_view,
            can_create: !!can_create,
            can_update: !!can_update,
            can_delete: !!can_delete,
            can_export: !!can_export,
        };

        // Upsert the flag row (tenant-stamped).
        const { data, error } = await supabase
            .from('role_module_permission')
            .upsert(
                {
                    role_id: Number(role_id),
                    module_id: Number(module_id),
                    company_id: companyId,
                    ...flags,
                },
                { onConflict: 'role_id,module_id' },
            )
            .select()
            .single();
        if (error) throw new ApiError(error.message, 500, error.code);

        // Keep the enforcement grant table in sync.
        await supabase
            .from('role_module_action_permission')
            .delete()
            .eq('role_id', Number(role_id))
            .eq('module_id', Number(module_id))
            .in('action', ['view', 'create', 'update', 'delete', 'export']);
        const rows = (['view', 'create', 'update', 'delete', 'export'] as const)
            .filter((a) => flags[`can_${a}` as keyof typeof flags])
            .map((action) => ({
                role_id: Number(role_id),
                module_id: Number(module_id),
                company_id: companyId,
                action,
                granted: true,
                created_by: ctx.userId,
                updated_by: ctx.userId,
            }));
        if (rows.length) {
            await supabase
                .from('role_module_action_permission')
                .upsert(rows, { onConflict: 'role_id,module_id,action' });
        }

        // Module type is a GLOBAL catalog attribute — changing it affects every
        // company, so gate it behind the module permission (super users only in
        // practice), not plain role management.
        if (
            module_type &&
            ['transaction', 'configuration', 'action'].includes(module_type)
        ) {
            await requirePermission(ctx, PERMISSIONS.setting.module.update, {
                req,
            });
            await supabase
                .from('modules')
                .update({ type: module_type })
                .eq('id', Number(module_id));
        }

        return NextResponse.json({ data }, { status: 201 });
    } catch (err) {
        if (err instanceof ApiError) return err.toResponse();
        return NextResponse.json(
            { error: err instanceof Error ? err.message : 'Unexpected error' },
            { status: 500 },
        );
    }
}
