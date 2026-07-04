import { getRequestContext } from '@/lib/request-context';
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
