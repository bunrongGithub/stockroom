import { getRequestContext } from '@/lib/request-context';
import { assertRole } from '@/lib/auth';
import { ApiError, ApiResponseSuccess } from '@/service/core/api-response';
import {
    assignCompanyRole,
    listCompanyUsers,
    removeCompanyUser,
} from '@/service/apps/base/company';
import { NextRequest } from 'next/server';

// GET /api/setting/company/users — paginated members of the caller's company.
// `?id=` targets another company (super admin only, enforced in the repo).
export async function GET(request: NextRequest) {
    const context = getRequestContext(request);
    try {
        const { searchParams } = request.nextUrl;
        const page = Math.max(1, Number(searchParams.get('page') ?? 1));
        const limit = Math.min(
            100,
            Math.max(1, Number(searchParams.get('limit') ?? 10)),
        );
        const overrideId = Number(searchParams.get('id')) || undefined;
        const data = await listCompanyUsers(context, { page, limit }, overrideId);
        return new ApiResponseSuccess(data).toResponse();
    } catch (exception) {
        if (exception instanceof ApiError) return exception.toResponse();
        return new ApiResponseSuccess(null, 'Unexpected Error', 500).toResponse();
    }
}

// POST /api/setting/company/users — assign (replace) a member's role.
export async function POST(request: NextRequest) {
    const context = getRequestContext(request);
    try {
        assertRole(context, 'admin');
        const body = await request.json();
        const data = await assignCompanyRole(context, body);
        return new ApiResponseSuccess({ data }, 'Success', 200).toResponse();
    } catch (exception) {
        if (exception instanceof ApiError) return exception.toResponse();
        return new ApiResponseSuccess(null, 'Unexpected Error', 500).toResponse();
    }
}

// DELETE /api/setting/company/users — remove a member from the company.
export async function DELETE(request: NextRequest) {
    const context = getRequestContext(request);
    try {
        assertRole(context, 'admin');
        const body = await request.json();
        const data = await removeCompanyUser(context, body);
        return new ApiResponseSuccess({ data }, 'Success', 200).toResponse();
    } catch (exception) {
        if (exception instanceof ApiError) return exception.toResponse();
        return new ApiResponseSuccess(null, 'Unexpected Error', 500).toResponse();
    }
}
