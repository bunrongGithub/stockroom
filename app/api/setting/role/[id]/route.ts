import { PERMISSIONS, requirePermission } from '@/service/core/authz';
import { getRequestContext } from '@/lib/request-context';
import {
    ApiError,
    ApiResponseSuccess,
    ValidationError,
} from '@/service/core/api-response';
import {
    updateRolePermissionsSchema,
    updateRoleSchema,
} from '@/service/schema/role.schema';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { Service } from '../route';


export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const context = getRequestContext(request);
        await requirePermission(context, PERMISSIONS.setting.role.view, { req: request });
        const { id } = await params;
        const data = await Service.findOne(context, Number(id));
        return new ApiResponseSuccess(data, 'Success', 200).toResponse();
    } catch (err) {


        console.log(err)
        if (err instanceof ApiError) return err.toResponse();
        return new ApiError('Unexpected error', 500).toResponse();
    }
}

export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const context = getRequestContext(req);
        await requirePermission(context, PERMISSIONS.setting.role.update, { req });
        const { id } = await params;
        const body = await req.json();

        const parsed = updateRoleSchema.safeParse(body);
        if (!parsed.success) {
            return new ValidationError(
                'Validation Errors',
                z.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
            ).toResponse();
        }

        const data = await Service.updateOne(context, Number(id), parsed.data);
        return new ApiResponseSuccess(data).toResponse();
    } catch (err) {
        if (err instanceof ApiError) return err.toResponse();
        return new ApiError('Unexpected error', 500).toResponse();
    }
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const context = getRequestContext(req);
        await requirePermission(context, PERMISSIONS.setting.role.update, { req });
        const { id } = await params;
        const body = await req.json();

        const parsed = updateRolePermissionsSchema.safeParse(body);
        if (!parsed.success) {
            return new ValidationError(
                'Validation Errors',
                z.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
            ).toResponse();
        }

        const data = await Service.updatePermissions(
            context,
            Number(id),
            parsed.data.permissions,
        );
        return new ApiResponseSuccess(data).toResponse();
    } catch (err) {
        if (err instanceof ApiError) return err.toResponse();
        return new ApiError('Unexpected error', 500).toResponse();
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const context = getRequestContext(req);
        await requirePermission(context, PERMISSIONS.setting.role.delete, { req });
        const { id } = await params;
        const data = await Service.deleteOne(context, Number(id));
        return new ApiResponseSuccess(data).toResponse();
    } catch (err) {
        if (err instanceof ApiError) return err.toResponse();
        return new ApiError('Unexpected error', 500).toResponse();
    }
}
