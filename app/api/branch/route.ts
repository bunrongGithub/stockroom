import { createClient } from '@/lib/supabase';
import { branchCreateSchema } from '@/lib/validations/branch.schema';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/branch — list branches the user has access to
export async function GET() {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user)
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 },
            );

        const { data, error } = await supabase
            .from('branch')
            .select(
                `
                *,
                user_branch!inner(user_id, role),
                stock_location(*)
            `,
            )
            .eq('user_branch.user_id', user.id)
            .order('is_default', { ascending: false })
            .order('name');

        if (error)
            return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ data }, { status: 200 });
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unexpected error';
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

// POST /api/branch
export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 },
            );
        }

        const body = await req.json();
        const parsed = branchCreateSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error.flatten().fieldErrors },
                { status: 422 },
            );
        }

        // ── Resolve company_id (2 fallback strategies) ──────────────────
        let companyId: number | null = null;

        // Strategy 1: from user_branch (existing branches)
        const { data: userBranches } = await supabase
            .from('user_branch')
            .select('branch_id, branch:branch_id(company_id)')
            .eq('user_id', user.id);

        if (userBranches && userBranches.length > 0) {
            const first = userBranches[0] as any;
            companyId = first?.branch?.company_id ?? null;
        }

        // Strategy 2: from inventory_item_category (legacy users)
        if (!companyId) {
            const { data: cat } = await supabase
                .from('inventory_item_category')
                .select('company_id')
                .eq('user_id', user.id)
                .limit(1)
                .maybeSingle();
            companyId = cat?.company_id ?? null;
        }

        // Strategy 3: ​បើ​​​​​​ user ​​​មិន​មាន​​​​​​​​ company ​ទាល់​តែ​សោះ ​​​​​យក​ company ​​​ដំបូង​ដែល​​មាន​ស្រាប់
        if (!companyId) {
            const { data: anyCompany } = await supabase
                .from('company')
                .select('id')
                .limit(1)
                .maybeSingle();
            companyId = anyCompany?.id ?? null;
        }

        if (!companyId) {
            return NextResponse.json(
                {
                    error: 'No company found in system. Please create a company first.',
                    debug: {
                        user_id: user.id,
                        user_branches_count: userBranches?.length ?? 0,
                    },
                },
                { status: 400 },
            );
        }

        // Unset other defaults if needed
        if (parsed.data.is_default) {
            await supabase
                .from('branch')
                .update({ is_default: false })
                .eq('company_id', companyId);
        }

        // Insert branch
        const { data: branch, error: insErr } = await supabase
            .from('branch')
            .insert({ ...parsed.data, company_id: companyId })
            .select()
            .single();

        if (insErr) {
            return NextResponse.json(
                { error: insErr.message },
                { status: 500 },
            );
        }

        // Auto-create Main Storage
        await supabase.from('stock_location').insert({
            branch_id: branch.id,
            name: 'Main Storage',
            code: 'MAIN',
            is_default: true,
            is_active: true,
        });

        // Auto-assign creator as owner
        await supabase.from('user_branch').insert({
            user_id: user.id,
            branch_id: branch.id,
            role: 'owner',
        });

        return NextResponse.json({ data: branch }, { status: 201 });
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unexpected error';
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
