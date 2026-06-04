import { getServerClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const { id } = await params;
        const body = await req.json();
        const { module_type, can_view, can_create, can_update, can_delete, can_export } = body;

        const supabase = getServerClient();

        const { data, error } = await supabase
            .from('role_module_permission')
            .update({ can_view: !!can_view, can_create: !!can_create, can_update: !!can_update, can_delete: !!can_delete, can_export: !!can_export })
            .eq('id', Number(id))
            .select('*, modules(id)')
            .single();

        if (error) throw error;

        if (module_type && ['transaction', 'configuration', 'action'].includes(module_type)) {
            const moduleId = (data as { modules: { id: number } }).modules?.id;
            if (moduleId) {
                await supabase.from('modules').update({ type: module_type }).eq('id', moduleId);
            }
        }

        return NextResponse.json({ data });
    } catch (err) {
        return NextResponse.json({ error: String(err) }, { status: 500 });
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
            .from('role_module_permission')
            .delete()
            .eq('id', Number(id));

        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (err) {
        return NextResponse.json({ error: String(err) }, { status: 500 });
    }
}
