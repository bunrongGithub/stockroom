import { PERMISSIONS, requirePermission } from '@/service/core/authz';
import { branchCreateSchema } from '@/service/schema/branch.schema';
import { NextRequest } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { z } from 'zod';

import {
    ApiError,
    ApiResponseSuccess,
    ValidationError,
} from '@/service/core/api-response';
import { service } from '../route';

export async function POST(req: NextRequest) {
    try {
        const ctx = getRequestContext(req);
        await requirePermission(ctx, PERMISSIONS.inventory.warehouse.create, { req: req });
        const body = await req.json();

        const parsed = branchCreateSchema.safeParse(body);
        if (!parsed.success) {
            return new ValidationError(
                'Validation failed',
                z.flattenError(parsed.error).fieldErrors,
            ).toResponse();
        }

        const warehouse = await service.insertOne(ctx, parsed.data);
        return new ApiResponseSuccess(warehouse, 'Created', 201).toResponse();
    } catch (error) {
        if (error instanceof ApiError) return error.toResponse();
        return new ApiResponseSuccess(
            null,
            'Unexpected Error',
            500,
        ).toResponse();
    }
}
