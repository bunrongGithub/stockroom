import { getServerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const supabase = getServerClient();
        const { data, error } = await supabase
            .from('modules')
            .select('id, key, label, path, component, parent_id, icon, sort_order, is_active, type')
            .eq('is_active', true)
            .order('sort_order', { ascending: true });

        if (error) throw error;
        return NextResponse.json({ data });
    } catch (err) {
        return NextResponse.json({ error: String(err) }, { status: 500 });
    }
}
