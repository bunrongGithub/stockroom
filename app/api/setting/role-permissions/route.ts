import { getRequestContext } from '@/lib/request-context';
import { getServerClient } from '@/lib/supabase/server';
import AppPermissionService from '@/service/apps/base/core/permission';
import { NextRequest, NextResponse } from 'next/server';

const Service = AppPermissionService.getInstance();
export async function GET(request: NextRequest) {
    const requestContext = getRequestContext(request);
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
            return NextResponse.json(
                { error: 'role_id and module_id are required' },
                { status: 422 },
            );
        }

        const supabase = getServerClient();

        // Upsert the permission row
        const { data, error } = await supabase
            .from('role_module_permission')
            .upsert(
                {
                    role_id: Number(role_id),
                    module_id: Number(module_id),
                    can_view: !!can_view,
                    can_create: !!can_create,
                    can_update: !!can_update,
                    can_delete: !!can_delete,
                    can_export: !!can_export,
                },
                { onConflict: 'role_id,module_id' },
            )
            .select()
            .single();

        if (error) throw error;

        // Optionally update the module's type
        if (
            module_type &&
            ['transaction', 'configuration', 'action'].includes(module_type)
        ) {
            await supabase
                .from('modules')
                .update({ type: module_type })
                .eq('id', Number(module_id));
        }

        return NextResponse.json({ data }, { status: 201 });
    } catch (err) {
        return NextResponse.json({ error: String(err) }, { status: 500 });
    }
}
