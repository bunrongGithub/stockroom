import { getRequestContext } from '@/lib/request-context';
import { assertRole } from '@/lib/auth';
import { ApiError, ApiResponseSuccess } from '@/service/core/api-response';
import { getCompany, updateCompany } from '@/service/apps/base/company';
import { NextRequest } from 'next/server';

type Params = { params: Promise<{ id: string }> };

function parseId(raw: string): number {
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0) {
        throw new ApiError('Invalid company id', 400, 'INVALID_ID');
    }
    return id;
}

// GET /api/setting/company/[id] — company detail. Non-super users can only
// read their own company (the repository rejects other ids).
export async function GET(request: NextRequest, { params }: Params) {
    const context = getRequestContext(request);
    try {
        const { id } = await params;
        const data = await getCompany(context, parseId(id));
        return new ApiResponseSuccess({ data }).toResponse();
    } catch (exception) {
        if (exception instanceof ApiError) return exception.toResponse();
        return new ApiResponseSuccess(null, 'Unexpected Error', 500).toResponse();
    }
}

// PATCH /api/setting/company/[id] — update company (owner/admin for their own
// company, super admin for any).
export async function PATCH(request: NextRequest, { params }: Params) {
    const context = getRequestContext(request);
    try {
        assertRole(context, 'admin');
        const { id } = await params;
        const body = await request.json();
        const data = await updateCompany(context, body, parseId(id));
        return new ApiResponseSuccess({ data }, 'Success', 200).toResponse();
    } catch (exception) {
        if (exception instanceof ApiError) return exception.toResponse();
        return new ApiResponseSuccess(null, 'Unexpected Error', 500).toResponse();
    }
}
