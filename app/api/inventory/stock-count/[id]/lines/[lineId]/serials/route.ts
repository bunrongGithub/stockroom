import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { StockCountLineRepository } from '@/service/apps/inventory/repo/stock-count';
import {
    recordSerialsSchema,
    removeSerialSchema,
    stockCountLineIdSchema,
} from '@/service/schema/stock-count.schema';
import { ApiError, ApiResponseSuccess } from '@/service/core/api-response';
import { z } from 'zod';

type LineRequestParam = { params: Promise<{ id: string; lineId: string }> };

const service = StockCountLineRepository.getInstance();

export async function GET(req: NextRequest, { params }: LineRequestParam) {
    try {
        const ctx = getRequestContext(req);
        const idParsed = stockCountLineIdSchema.safeParse(await params);
        if (!idParsed.success) {
            return NextResponse.json(
                { error: 'Invalid stock count line ID' },
                { status: 400 },
            );
        }
        const data = await service.listSerials(
            ctx,
            idParsed.data.id,
            idParsed.data.lineId,
        );
        return new ApiResponseSuccess({ data }, 'Success').toResponse();
    } catch (error) {
        if (error instanceof ApiError) return error.toResponse();
        const message =
            error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function POST(req: NextRequest, { params }: LineRequestParam) {
    try {
        const ctx = getRequestContext(req);
        const idParsed = stockCountLineIdSchema.safeParse(await params);
        if (!idParsed.success) {
            return NextResponse.json(
                { error: 'Invalid stock count line ID' },
                { status: 400 },
            );
        }
        const parsed = recordSerialsSchema.safeParse(await req.json());
        if (!parsed.success) {
            return NextResponse.json(
                { error: z.flattenError(parsed.error).fieldErrors },
                { status: 422 },
            );
        }
        const data = await service.recordSerials(
            ctx,
            idParsed.data.id,
            idParsed.data.lineId,
            parsed.data.serials,
        );
        return new ApiResponseSuccess({ data }, 'Success').toResponse();
    } catch (error) {
        if (error instanceof ApiError) return error.toResponse();
        const message =
            error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params }: LineRequestParam) {
    try {
        const ctx = getRequestContext(req);
        const idParsed = stockCountLineIdSchema.safeParse(await params);
        if (!idParsed.success) {
            return NextResponse.json(
                { error: 'Invalid stock count line ID' },
                { status: 400 },
            );
        }
        const parsed = removeSerialSchema.safeParse(await req.json());
        if (!parsed.success) {
            return NextResponse.json(
                { error: z.flattenError(parsed.error).fieldErrors },
                { status: 422 },
            );
        }
        const data = await service.removeSerial(
            ctx,
            idParsed.data.id,
            idParsed.data.lineId,
            parsed.data.serial_number,
        );
        return new ApiResponseSuccess({ data }, 'Success').toResponse();
    } catch (error) {
        if (error instanceof ApiError) return error.toResponse();
        const message =
            error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
