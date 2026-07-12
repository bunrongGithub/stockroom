import { getRequestContext } from '@/lib/request-context';
import { ApiError, ApiResponseSuccess } from '@/service/core/api-response';
import { Role } from '@/service/apps/base/core/role';
import { NextRequest } from 'next/server';

export const Service = new Role();

export async function GET(request: NextRequest) {
    const context = getRequestContext(request);
    const { searchParams } = request.nextUrl;
    const page = Math.max(1, Number(searchParams.get('page') ?? 1));
    // Default stays 10 per page; dropdown callers may request more.
    const limit = Math.min(
        1000,
        Math.max(1, Number(searchParams.get('limit') ?? 10)),
    );
    const companyId = Number(searchParams.get('company_id')) || undefined;
    try {
        const data = await Service.findAll(
            context,
            { page, limit },
            companyId,
        );
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
        const body = await request.json();
        const data = await Service.insertOne(context, body);
        return new ApiResponseSuccess({ data }, 'Created', 201).toResponse();
    } catch (exception) {
        if (exception instanceof ApiError) return exception.toResponse();
        return new ApiResponseSuccess(
            null,
            'Unexpected Error',
            500,
        ).toResponse();
    }
}
