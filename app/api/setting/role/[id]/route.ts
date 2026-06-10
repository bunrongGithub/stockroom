import { getServerClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const { id } = await params;
        const supabase = getServerClient();

        const [{ data: role, error: roleErr }, { data: permissions, error: permErr }, { data: allModules }] =
            await Promise.all([
                supabase
                    .from('roles')
                    .select('id, name, description, company(id, name)')
                    .eq('id', Number(id))
                    .single(),

                supabase
                    .from('role_module_permission')
                    .select(
                        'id, module_id, can_view, can_create, can_update, can_delete, can_export, modules(id, label, type, icon, parent_id, key, path, sort_order)',
                    )
                    .eq('role_id', Number(id)),

                supabase
                    .from('modules')
                    .select('id, label, type, icon, parent_id, key, path, sort_order')
                    .eq('is_active', true)
                    .order('sort_order', { ascending: true }),
            ]);

        if (roleErr || !role)
            return NextResponse.json({ error: 'Role not found' }, { status: 404 });
        if (permErr) throw permErr;

        return NextResponse.json({
            data: { role, permissions: permissions ?? [], allModules: allModules ?? [] },
        });
    } catch (err) {
        return NextResponse.json({ error: String(err) }, { status: 500 });
    }
}

export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const { id } = await params;
        const { name, description } = await req.json();
        if (!name?.trim()) {
            return NextResponse.json({ error: 'Name is required' }, { status: 422 });
        }

        const supabase = getServerClient();
        const { data, error } = await supabase
            .from('roles')
            .update({ name: name.trim(), description: description?.trim() ?? null })
            .eq('id', Number(id))
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json({ data });
    } catch (err) {
        const msg = String(err);
        const status = msg.includes('unique') ? 409 : 500;
        return NextResponse.json({ error: msg }, { status });
    }
}

export async function DELETE(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const { id } = await params;
        const supabase = getServerClient();
        const { error } = await supabase
            .from('roles')
            .delete()
            .eq('id', Number(id));

        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (err) {
        return NextResponse.json({ error: String(err) }, { status: 500 });
    }
}
