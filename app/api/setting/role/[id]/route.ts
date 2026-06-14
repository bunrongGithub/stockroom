import { getRequestContext } from '@/lib/request-context';
import { getServerClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { Service } from '../route';
import { ApiResponseSuccess } from '@/service/core/api-response';

export async function GET(
    requuest: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const context = getRequestContext(requuest);
    const { id } = await params;

    const data = await Service.findOne(context, Number(id));

    return new ApiResponseSuccess(data, 'Success', 200).toResponse();
}

export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const { id } = await params;
        const { name, description } = await req.json();
        if (!name?.trim()) {
            return NextResponse.json(
                { error: 'Name is required' },
                { status: 422 },
            );
        }

        const supabase = getServerClient();
        const { data, error } = await supabase
            .from('roles')
            .update({
                name: name.trim(),
                description: description?.trim() ?? null,
            })
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
