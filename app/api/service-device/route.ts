import { createClient } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
    try {
        const supabase = await createClient();

        const { data: userData, error: authError } =
            await supabase.auth.getUser();
        if (authError || !userData?.user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 },
            );
        }

        const { data, error } = await supabase
            .from('service_device')
            .select('id, name, brand, device_type, image_url, is_active')
            .eq('is_active', true)
            .order('brand', { ascending: true })
            .order('name', { ascending: true });

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

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();

        const { data: userData, error: authError } =
            await supabase.auth.getUser();
        if (authError || !userData?.user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 },
            );
        }

        const body = await req.json();

        if (!body.name) {
            return NextResponse.json(
                { error: 'Name is required' },
                { status: 400 },
            );
        }

        const { data, error } = await supabase
            .from('service_device')
            .insert({
                name: body.name,
                brand: body.brand || null,
                device_type: body.device_type || 'phone',
            })
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ data }, { status: 201 });
    } catch (error) {
        const message =
            error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
