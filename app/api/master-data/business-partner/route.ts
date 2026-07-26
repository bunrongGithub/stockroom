import { PERMISSIONS, requirePermission } from '@/service/core/authz';
import { getRequestContext } from '@/lib/request-context';
import { ApiError, ApiResponseSuccess } from '@/service/core/api-response';
import { parseListParams } from '@/service/core/query/http.ts';
import { createBusinessPartnerSchema } from '@/service/schema/business-partner.schema';
import { BusinessPartnerRepository } from '@/service/apps/master-data/business-partner';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export const Service = BusinessPartnerRepository.getInstance();

/** List partners. Supports ?filter[role]=customer, ?filter[is_active], search. */
export async function GET(req: NextRequest) {
    try {
        const ctx = getRequestContext(req);
        await requirePermission(ctx, PERMISSIONS.masterData.partner.view, { req });
        const query = parseListParams(req);
        const result = await Service.findAllV2(ctx, query);
        return new ApiResponseSuccess(result, 'Success').toResponse();
    } catch (error) {
        if (error instanceof ApiError) return error.toResponse();
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const ctx = getRequestContext(req);
        await requirePermission(ctx, PERMISSIONS.masterData.partner.create, { req });
        const body = await req.json();

        const parsed = createBusinessPartnerSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: z.flattenError(parsed.error).fieldErrors },
                { status: 422 },
            );
        }

        const partner = await Service.insertOne(ctx, parsed.data);

        // Phones are not unique — a family or a switchboard may share one — so
        // a duplicate is reported alongside the created partner rather than
        // blocking the save.
        const duplicates = partner.phone
            ? (await Service.findByPhone(ctx, partner.phone)).filter(
                  (p) => p.id !== partner.id,
              )
            : [];

        return NextResponse.json(
            {
                data: partner,
                warnings: duplicates.length
                    ? [
                          {
                              code: 'DUPLICATE_PHONE',
                              message: `${duplicates.length} other partner(s) share this phone number.`,
                              partners: duplicates.map((p) => ({
                                  id: p.id,
                                  code: p.code,
                                  name: p.name,
                              })),
                          },
                      ]
                    : [],
            },
            { status: 201 },
        );
    } catch (error) {
        if (error instanceof ApiError) return error.toResponse();
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
