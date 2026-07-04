import { getRequestContext } from '@/lib/request-context';
import { getServerClient } from '@/lib/supabase/server';
import { UserRepository } from '@/service/apps/base/auth/repo/user.repo';
import { ApiResponseSuccess } from '@/service/core/api-response';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const context = getRequestContext(request);
    const params = request.nextUrl.searchParams;
    const page = Number(params.get('page') || 1);
    const limit = Number(params.get('limit') || 10);
    const search = params.get('search') ?? undefined;
    try {
        // const supabase = getServerClient();

        // const [{ data: authData, error: authErr }, { data: profiles }, { data: userRoles }] =
        //     await Promise.all([
        //         supabase.auth.admin.listUsers(),
        //         supabase.from('profiles').select('id, company_id, full_name'),
        //         supabase
        //             .from('user_role')
        //             .select('user_id, roles(id, name)'),
        //     ]);

        // if (authErr) throw authErr;

        // const profileMap = new Map(
        //     (profiles ?? []).map((p) => [p.id as string, p]),
        // );

        // const rolesByUser = new Map<string, string[]>();
        // for (const ur of userRoles ?? []) {
        //     const userId = (ur as { user_id: string }).user_id;
        //     const rolesField = (ur as unknown as { roles: { name: string } | { name: string }[] }).roles;
        //     const roleName = Array.isArray(rolesField) ? rolesField[0]?.name : rolesField?.name;
        //     if (!rolesByUser.has(userId)) rolesByUser.set(userId, []);
        //     if (roleName) rolesByUser.get(userId)!.push(roleName);
        // }

        // const data = (authData?.users ?? []).map((u) => ({
        //     id: u.id,
        //     email: u.email ?? '',
        //     full_name: profileMap.get(u.id)?.full_name ?? null,
        //     company_id: profileMap.get(u.id)?.company_id ?? null,
        //     roles: rolesByUser.get(u.id) ?? [],
        //     created_at: u.created_at,
        // }));
        const userRepository = new UserRepository();
        const data = await userRepository.findAll(context, {
            page: page,
            limit: limit,
            search: search,
            searchColumn: 'full_name',
        });
        return new ApiResponseSuccess(data, 'Success').toResponse();
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
