import { createClient } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

type Params = Promise<{ id: string }>;

export async function GET(req: NextRequest, props: { params: Params }) {
    try {
        const supabase = await createClient();
        const params = await props.params;

        const { data: userData, error: authError } =
            await supabase.auth.getUser();
        if (authError || !userData?.user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 },
            );
        }

        const { data, error } = await supabase
            .from('repair_service')
            .select(
                `
                *,
                device:service_device(id, name, brand, device_type),
                category:service_category(id, name)
            `,
            )
            .eq('id', params.id)
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 404 });
        }

        return NextResponse.json({ data }, { status: 200 });
    } catch (error) {
        const message =
            error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest, props: { params: Params }) {
    try {
        const supabase = await createClient();
        const params = await props.params;

        const { data: userData, error: authError } =
            await supabase.auth.getUser();
        if (authError || !userData?.user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 },
            );
        }

        const body = await req.json();

        // Prepare update data, exclude fields that shouldn't be updated directly like id
        const updateData = { ...body, updated_at: new Date().toISOString() };
        delete updateData.id;
        delete updateData.created_at;
        delete updateData.reference_no; // Prevents overwriting auto-generated ref

        const { data, error } = await supabase
            .from('repair_service')
            .update(updateData)
            .eq('id', params.id)
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ data }, { status: 200 });
    } catch (error) {
        const message =
            error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, props: { params: Params }) {
    try {
        const supabase = await createClient();
        const params = await props.params;

        const { data: userData, error: authError } =
            await supabase.auth.getUser();
        if (authError || !userData?.user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 },
            );
        }

        const { data, error } = await supabase
            .from('repair_service')
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq('id', params.id)
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ data }, { status: 200 });
    } catch (error) {
        const message =
            error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
