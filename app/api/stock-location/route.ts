import { createClient } from '@/lib/supabase/server';
import { stockLocationCreateSchema } from '@/lib/validations/branch.schema';
import { NextRequest, NextResponse } from 'next/server';

// POST /api/stock-location
export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const parsed = stockLocationCreateSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error.flatten().fieldErrors },
                { status: 422 },
            );
        }

        // Verify user has access to this branch
        const { data: access } = await supabase
            .from('user_branch')
            .select('role')
            .eq('user_id', user.id)
            .eq('branch_id', parsed.data.branch_id)
            .maybeSingle();
        if (!access) {
            return NextResponse.json({ error: 'No access to this branch' }, { status: 403 });
        }

        if (parsed.data.is_default) {
            await supabase
                .from('stock_location')
                .update({ is_default: false })
                .eq('branch_id', parsed.data.branch_id);
        }

        const { data, error } = await supabase
            .from('stock_location')
            .insert({ ...parsed.data, is_active: true })
            .select()
            .single();

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ data }, { status: 201 });
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unexpected error';
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}