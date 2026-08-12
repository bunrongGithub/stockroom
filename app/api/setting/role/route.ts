import { PERMISSIONS, requirePermission } from '@/service/core/authz';
import { getRequestContext } from '@/lib/request-context';
import { ApiError, ApiResponseSuccess } from '@/service/core/api-response';
import { Role } from '@/service/apps/base/core/role';
import { parseListParams } from '@/service/core/query/http';
import { NextRequest } from 'next/server';

export const Service = new Role();

export async function GET(request: NextRequest) {
    const context = getRequestContext(request);
    try {
        await requirePermission(context, PERMISSIONS.setting.role.view, {
            req: request,
        });
        const data = await Service.findAllV2(context, parseListParams(request));
        const response = new ApiResponseSuccess(data).toResponse();
        return response;
    } catch (exception) {
        if (exception instanceof ApiError) return exception.toResponse();
        return new ApiResponseSuccess(
            null,
            'Unexpected Error',
            500,
        ).toResponse();
    }
}

export async function POST(request: NextRequest) {
    const context = getRequestContext(request);
    try {
        await requirePermission(context, PERMISSIONS.setting.role.create, {
            req: request,
        });
        const body = await request.json();
        // The permission editor posts the role header and its grants together;
        // callers that only send a header still work (permissions defaults []).
        const data = await Service.createWithGrants(context, body);
        return new ApiResponseSuccess(data, 'Created', 201).toResponse();
    } catch (exception) {
        if (exception instanceof ApiError) return exception.toResponse();
        return new ApiResponseSuccess(
            null,
            'Unexpected Error',
            500,
        ).toResponse();
    }
}
