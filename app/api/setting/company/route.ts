import { PERMISSIONS, requirePermission } from '@/service/core/authz';
import { getRequestContext } from '@/lib/request-context';
import { ApiError, ApiResponseSuccess } from '@/service/core/api-response';
import {
    createCompany,
    getCompany,
    listCompanies,
    updateCompany,
} from '@/service/apps/base/company';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/setting/company — paginated company list. Super users see every
// company; everyone else gets a single-row list with their own company.
// `?id=` keeps the legacy single-company response for the detail tabs.
export async function GET(request: NextRequest) {
    const context = getRequestContext(request);
    await requirePermission(context, PERMISSIONS.setting.company.view, { req: request });
    try {
        const sp = request.nextUrl.searchParams;
        const idParam = sp.get('id');
        if (idParam || sp.get('self')) {
            const data = await getCompany(
                context,
                idParam ? Number(idParam) : undefined,
            );
            return new ApiResponseSuccess({ data }).toResponse();
        }

        const result = await listCompanies(context, {
            page: Math.max(1, Number(sp.get('page') ?? 1)),
            limit: Math.min(100, Math.max(1, Number(sp.get('limit') ?? 10))),
            search: sp.get('search') ?? undefined,
        });
        return NextResponse.json(result, { status: 200 });
    } catch (exception) {
        if (exception instanceof ApiError) return exception.toResponse();
        return new ApiResponseSuccess(null, 'Unexpected Error', 500).toResponse();
    }
}

// POST /api/setting/company — create a company (super admin only; the
// repository enforces the super-user check).
export async function POST(request: NextRequest) {
    const context = getRequestContext(request);
    await requirePermission(context, PERMISSIONS.setting.company.create, { req: request });
    try {
        const body = await request.json();
        const data = await createCompany(context, body);
        return new ApiResponseSuccess({ data }, 'Created', 201).toResponse();
    } catch (exception) {
        if (exception instanceof ApiError) return exception.toResponse();
        return new ApiResponseSuccess(null, 'Unexpected Error', 500).toResponse();
    }
}

// PATCH /api/setting/company — owner/admin/super_admin only.
export async function PATCH(request: NextRequest) {
    const context = getRequestContext(request);
    await requirePermission(context, PERMISSIONS.setting.company.update, { req: request });
    try {
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
