import { PERMISSIONS, requirePermission } from '@/service/core/authz';
import { createInventorySchema } from '@/service/schema/inventory.schema';
import { NextRequest } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { z } from 'zod';
import { Service } from '../route';
import {
    ApiResponseSuccess,
    ValidationError,
} from '@/service/core/api-response';
import { ApiError } from '@/service/core/api-response';
export async function POST(req: NextRequest) {
    try {
        const ctx = getRequestContext(req);
        await requirePermission(ctx, PERMISSIONS.inventory.item.create, { req: req });
        const body = await req.json();

        const parsed = createInventorySchema.safeParse({
            ...body,
            item_class: 'stock',
        });

        if (!parsed.success) {
            const fieldErros = z.flattenError(parsed.error).fieldErrors;
            return new ValidationError(
                'Validation Errors',
                fieldErros,
            ).toResponse();
        }

        const item = await Service.insertOne(ctx, parsed.data);
        return new ApiResponseSuccess(item, 'Created', 201).toResponse();
    } catch (error) {
        const message =
            error instanceof Error ? error.message : 'Unexpected error';
        return new ApiError(message, 500).toResponse();
    }
}
