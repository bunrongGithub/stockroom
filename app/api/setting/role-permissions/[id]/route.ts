import { getRequestContext } from '@/lib/request-context';
import { PERMISSIONS, requirePermission } from '@/service/core/authz';
import { getServerClient } from '@/lib/supabase/server';
import { ApiError, NotFoundError } from '@/service/core/api-response';
import type { RequestContext } from '@/types/request-context';
import { NextRequest, NextResponse } from 'next/server';

const CRUD = ['view', 'create', 'update', 'delete', 'export'] as const;

/**
 * Rewrite the action-grant rows for a (role, module) to match the CRUD flags,
 * so enforcement (which reads role_module_action_permission) reflects the edit.
 */
async function syncActionGrants(
    ctx: RequestContext,
    roleId: number,
    moduleId: number,
    companyId: number,
    flags: Record<string, boolean>,
) {
    const supabase = getServerClient();
    await supabase
        .from('role_module_action_permission')
        .delete()
        .eq('role_id', roleId)
        .eq('module_id', moduleId)
        .in('action', CRUD as unknown as string[]);
    const rows = CRUD.filter((a) => flags[`can_${a}`]).map((action) => ({
        role_id: roleId,
        module_id: moduleId,
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
}

export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const ctx = getRequestContext(req);
        await requirePermission(ctx, PERMISSIONS.setting.role.update, { req });
        const { id } = await params;
        const body = await req.json();
        const flags = {
            can_view: !!body.can_view,
            can_create: !!body.can_create,
            can_update: !!body.can_update,
            can_delete: !!body.can_delete,
            can_export: !!body.can_export,
        };

        const supabase = getServerClient();
        // Object-level security: only rows in the caller's company; 0 rows
        // updated → 404 (never reveal that another company's row exists).
        const { data, error } = await supabase
            .from('role_module_permission')
            .update(flags)
            .eq('id', Number(id))
            .eq('company_id', Number(ctx.companyId))
            .select('id, role_id, module_id, company_id')
            .maybeSingle();
        if (error) throw new ApiError(error.message, 500, error.code);
        if (!data) throw new NotFoundError('Permission not found');

        await syncActionGrants(
            ctx,
            data.role_id,
            data.module_id,
            data.company_id,
            flags,
        );

        if (
            body.module_type &&
            ['transaction', 'configuration', 'action'].includes(body.module_type)
        ) {
            // Module type is a global catalog attribute — gate it separately so a
            // tenant admin can't reshape modules for every company.
            await requirePermission(ctx, PERMISSIONS.setting.module.update, {
                req,
            });
            await supabase
                .from('modules')
                .update({ type: body.module_type })
                .eq('id', data.module_id);
        }

        return NextResponse.json({ data });
    } catch (err) {
        if (err instanceof ApiError) return err.toResponse();
        return NextResponse.json(
            { error: err instanceof Error ? err.message : 'Unexpected error' },
            { status: 500 },
        );
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const ctx = getRequestContext(req);
        await requirePermission(ctx, PERMISSIONS.setting.role.update, { req });
        const { id } = await params;

        const supabase = getServerClient();
        const { data, error } = await supabase
            .from('role_module_permission')
            .delete()
            .eq('id', Number(id))
            .eq('company_id', Number(ctx.companyId))
            .select('role_id, module_id')
            .maybeSingle();
        if (error) throw new ApiError(error.message, 500, error.code);
        if (!data) throw new NotFoundError('Permission not found');

        await supabase
            .from('role_module_action_permission')
            .delete()
            .eq('role_id', data.role_id)
            .eq('module_id', data.module_id)
            .in('action', CRUD as unknown as string[]);

        return NextResponse.json({ success: true });
    } catch (err) {
        if (err instanceof ApiError) return err.toResponse();
        return NextResponse.json(
            { error: err instanceof Error ? err.message : 'Unexpected error' },
            { status: 500 },
        );
    }
}
