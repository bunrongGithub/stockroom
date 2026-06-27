import { RequestParam } from '@/app/api/http';
import { getRequestContext } from '@/lib/request-context';
import { NextRequest, NextResponse } from 'next/server';
import { service } from '../../route';
import {
    ApiError,
    ApiResponseSuccess,
    NotFoundError,
    ValidationError,
} from '@/service/core/api-response';
import { branchUpdateSchema } from '@/service/schema/branch.schema';
import { z } from 'zod';

const locationItemSchema = z.object({
    id: z.number().optional(),
    name: z.string().min(1, 'Location name is required'),
    code: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    is_active: z.boolean(),
    is_default: z.boolean(),
});

const updateWithLocationsSchema = branchUpdateSchema.extend({
    locations: z.array(locationItemSchema).optional(),
    removed_location_ids: z.array(z.number()).optional(),
});

export async function GET(request: NextRequest, { params }: RequestParam) {
    try {
        const context = getRequestContext(request);
        const { id } = await params;
        const warehouse = await service.findOne(context, parseInt(id));
        if (!warehouse) {
            return new NotFoundError('Warehouse not found').toResponse();
        }
        return NextResponse.json(warehouse);
    } catch (error) {
        if (error instanceof ApiError) return error.toResponse();
        return new ApiError(
            error instanceof Error ? error.message : 'Unexpected error',
        ).toResponse();
    }
}

export async function PUT(request: NextRequest, { params }: RequestParam) {
    try {
        const context = getRequestContext(request);
        const { id } = await params;
        const warehouseId = parseInt(id);
        const body = await request.json();

        const parsed = updateWithLocationsSchema.safeParse(body);
        if (!parsed.success) {
            return new ValidationError(
                'Validation failed',
                z.flattenError(parsed.error).fieldErrors,
            ).toResponse();
        }

        const { locations, removed_location_ids, ...warehouseFields } =
            parsed.data;

        await service.updateOne(context, warehouseId, warehouseFields);

        if (locations !== undefined || removed_location_ids !== undefined) {
            await service.syncLocations(
                warehouseId,
                locations ?? [],
                removed_location_ids ?? [],
            );
        }

        const result = await service.findOne(context, warehouseId);
        return new ApiResponseSuccess(result, 'Success', 200).toResponse();
    } catch (error) {
        if (error instanceof ApiError) return error.toResponse();
        return new ApiError(
            error instanceof Error ? error.message : 'Unexpected error',
        ).toResponse();
    }
}
