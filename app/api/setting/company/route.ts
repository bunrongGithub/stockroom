import { getRequestContext } from '@/lib/request-context';
import { assertRole } from '@/lib/auth';
import { ApiError, ApiResponseSuccess } from '@/service/core/api-response';
import { getCompany, updateCompany } from '@/service/apps/base/company';
import { NextRequest } from 'next/server';

// GET /api/setting/company — the caller's own company.
// `?id=` is honored only for super_admin (cross-company by explicit intent).
export async function GET(request: NextRequest) {
    const context = getRequestContext(request);
    try {
        const idParam = request.nextUrl.searchParams.get('id');
        const overrideId = idParam ? Number(idParam) : undefined;
        const data = await getCompany(context, overrideId);
        return new ApiResponseSuccess({ data }).toResponse();
    } catch (exception) {
        if (exception instanceof ApiError) return exception.toResponse();
        return new ApiResponseSuccess(null, 'Unexpected Error', 500).toResponse();
    }
}

// PATCH /api/setting/company — owner/admin/super_admin only.
export async function PATCH(request: NextRequest) {
    const context = getRequestContext(request);
    try {
        assertRole(context, 'admin');
        const body = await request.json();
        const idParam = request.nextUrl.searchParams.get('id');
        const overrideId = idParam ? Number(idParam) : undefined;
        const data = await updateCompany(context, body, overrideId);
        return new ApiResponseSuccess({ data }, 'Success', 200).toResponse();
    } catch (exception) {
        if (exception instanceof ApiError) return exception.toResponse();
        return new ApiResponseSuccess(null, 'Unexpected Error', 500).toResponse();
    }
}
