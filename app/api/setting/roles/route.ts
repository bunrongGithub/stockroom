import { getServerClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
    try {
        const supabase = getServerClient();
        const { data, error } = await supabase
            .from('roles')
            .select('id, name, description, created_at')
            .order('id', { ascending: true });

        if (error) throw error;
        return NextResponse.json({ data });
    } catch (err) {
        return NextResponse.json({ error: String(err) }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const { name, description } = await req.json();
        if (!name?.trim()) {
            return NextResponse.json({ error: 'Name is required' }, { status: 422 });
        }

        const supabase = getServerClient();
        const { data, error } = await supabase
            .from('roles')
            .insert({ name: name.trim(), description: description?.trim() ?? null })
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json({ data }, { status: 201 });
    } catch (err) {
        const msg = String(err);
        const status = msg.includes('unique') ? 409 : 500;
        return NextResponse.json({ error: msg }, { status });
    }
}
