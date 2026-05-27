import { createClient } from '@/lib/supabase/server';
import { stockLocationCreateSchema } from '@/lib/validations/branch.schema';
import { NextRequest, NextResponse } from 'next/server';

type UserBranchRow = {
    branch_id: number | null;
};

// GET /api/stock-location
// Optional query params: ?branch_id=X
// Returns active stock locations from branches the current user can access.
export async function GET(req: NextRequest) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const branchId = req.nextUrl.searchParams.get('branch_id');

        const { data: userBranches, error: branchErr } = await supabase
            .from('user_branch')
            .select('branch_id')
            .eq('user_id', user.id);

        if (branchErr) {
            return NextResponse.json({ error: branchErr.message }, { status: 500 });
        }

        const branchIds = ((userBranches ?? []) as UserBranchRow[])
            .map((branch) => branch.branch_id)
            .filter((id): id is number => typeof id === 'number');

        if (branchIds.length === 0) {
            return NextResponse.json({ data: [] }, { status: 200 });
        }

        let query = supabase
            .from('stock_location')
            .select(
                `
                id,
                branch_id,
                name,
                code,
                description,
                is_default,
                is_active,
                created_at,
                updated_at,
                warehouse:branch_id ( id, name )
            `,
            )
            .in('branch_id', branchIds)
            .eq('is_active', true)
            .order('is_default', { ascending: false })
            .order('name');

        if (branchId) {
            query = query.eq('branch_id', Number(branchId));
        }

        const { data, error } = await query;
        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ data: data ?? [] }, { status: 200 });
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unexpected error';
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

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
