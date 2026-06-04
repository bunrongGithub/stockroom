import { getServerClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
    try {
        const supabase = getServerClient();
        const { data, error } = await supabase
            .from('role_module_permission')
            .select(
                'id, role_id, module_id, can_view, can_create, can_update, can_delete, can_export, created_at, roles(id, name), modules(id, label, path, type)',
            )
            .order('role_id', { ascending: true });

        if (error) throw error;
        return NextResponse.json({ data });
    } catch (err) {
        return NextResponse.json({ error: String(err) }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { role_id, module_id, module_type, can_view, can_create, can_update, can_delete, can_export } = body;

        if (!role_id || !module_id) {
            return NextResponse.json({ error: 'role_id and module_id are required' }, { status: 422 });
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
        if (module_type && ['transaction', 'configuration', 'action'].includes(module_type)) {
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
